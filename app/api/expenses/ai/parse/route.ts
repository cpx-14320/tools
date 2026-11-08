import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import { listCategories } from "@/lib/expenses/categories.server";
import { createAiDraft, findAiDraftByInput, findRecentAiDraft } from "@/lib/expenses/ai-drafts.server";
import { AI_MAX_ITEMS, mockParse } from "@/lib/expenses/ai-mock";
import type { InvoiceQrResult } from "@/lib/expenses/invoice-qr";
import { todayInTaipei } from "@/lib/expenses/pet.server";

/** 把一句話解析成一批待確認的收支紀錄。
 *
 *  金鑰由前端隨請求送來、**用完即丟**，伺服器不存（見 use-ai-key.ts）。所以這支 route
 *  絕對不能把 request body 寫進任何 log——金鑰在裡面。
 *
 *  沒帶金鑰時走 mockParse：真的去讀使用者打的句子、抓金額、用名稱配分類，讓整條流程
 *  （待確認、編輯、寫入、批次管理）在還沒有 API 金鑰之前就能完整驗收。真的接上模型時
 *  只要把這裡換成一次 Structured Outputs 呼叫，前後端其他部分都不用動。 */
export async function POST(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const userId0 = new ObjectId(user.id);

  // ── 掃發票 ────────────────────────────────────────────────────────────────
  // 前端已經在瀏覽器裡把 QR 解完了（見 scan-invoice-qr.ts），送過來的是結構化資料，
  // 不是圖片——照片不會離開使用者的裝置，伺服器也不用處理檔案上傳。
  if (body?.invoice) {
    return handleInvoice(userId0, body.invoice as InvoiceQrResult);
  }

  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  if (!text) return NextResponse.json({ error: "請先輸入一段文字" }, { status: 400 });

  const userId = userId0;

  // 同一段文字短時間內重送，直接回上一批——擋住「按了沒反應以為沒送出、再按一次」
  // 造成的重複花費與重複草稿。
  const recent = await findRecentAiDraft(userId, text);
  if (recent) return NextResponse.json({ draft: recent, reused: true });

  const categories = await listCategories(userId);

  // 還沒接上真的模型。有帶金鑰時先明講，不要默默回假資料讓人以為是模型判的。
  if (apiKey) {
    return NextResponse.json({ error: "真實模型還沒接上，目前只能用模擬解析（先把金鑰清掉試試）" }, { status: 501 });
  }

  const items = mockParse(text, categories, todayInTaipei());
  if (items.length === 0) {
    return NextResponse.json({ error: "這段文字裡找不到金額，試試「午餐便當 120」這種寫法" }, { status: 422 });
  }

  const draft = await createAiDraft(userId, {
    source: "text",
    inputSummary: text.length > 30 ? `${text.slice(0, 30)}…` : text,
    inputText: text,
    model: "mock",
    items,
  });
  return NextResponse.json({ draft, maxItems: AI_MAX_ITEMS });
}

/** 一張發票 ＝ 一筆帳，不是一個品項一筆。
 *
 *  去全聯買五樣東西，記帳要的是「全聯 850」一筆，不是五筆各一百多的流水帳——明細塞進
 *  備註就夠了。品名拿來猜分類（買的是什麼，比店名更能決定歸哪一類）。
 *
 *  分類判斷直接重用 mockParse：把「品名 總金額」組成一行文字丟進去，就能沿用它那套
 *  關鍵字字典與分類比對，不用為發票另外寫一份。todayISO 傳發票日期，這樣 mockParse
 *  在句子裡找不到日期時填的預設值就是開立日期，而不是今天。 */
async function handleInvoice(userId: ObjectId, invoice: InvoiceQrResult) {
  const amount = Number(invoice?.totalAmount);
  if (!invoice?.invoiceNumber || !invoice?.date || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "這張發票的資料讀不完整，再掃一次或手動輸入" }, { status: 422 });
  }

  // 發票號碼是唯一的，拿它當這一批的識別。同一張掃第二次就擋下來——重複記帳是使用者
  // 很難自己發現的錯（金額對、日期對，只是多了一筆）。
  const inputText = `invoice:${invoice.invoiceNumber}`;
  const existing = await findAiDraftByInput(userId, inputText);
  if (existing) {
    if (existing.status === "pending") return NextResponse.json({ draft: existing, reused: true });
    return NextResponse.json({ error: `發票 ${invoice.invoiceNumber} 已經記過了` }, { status: 409 });
  }

  const categories = await listCategories(userId);
  const names = (invoice.items ?? []).map((i) => i.name).filter(Boolean);
  const [item] = mockParse(`${names.join(" ")} ${amount}`.trim(), categories, invoice.date);

  const draft = await createAiDraft(userId, {
    source: "invoice",
    inputSummary: names.length > 0 ? names.slice(0, 3).join("、") : `發票 ${invoice.invoiceNumber}`,
    inputText,
    model: "invoice-qr",
    items: [
      {
        // mockParse 一定找得到金額（我們自己把金額接在字串後面），但萬一分類那段出意外，
        // 至少要留下一筆金額正確、分類待補的紀錄，不要整張掃完卻什麼都沒進去。
        key: `0-${invoice.invoiceNumber}`,
        categoryId: item?.categoryId ?? null,
        amount,
        date: invoice.date,
        note: names.length > 0 ? names.join("、") : `發票 ${invoice.invoiceNumber}`,
        state: "pending",
        categoryHintId: item?.categoryHintId,
        aiGuess: item?.aiGuess,
      },
    ],
  });
  return NextResponse.json({ draft });
}
