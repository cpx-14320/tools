import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import { listCategories } from "@/lib/expenses/categories.server";
import { createAiDraft, findRecentAiDraft } from "@/lib/expenses/ai-drafts.server";
import { AI_MAX_ITEMS, mockParse } from "@/lib/expenses/ai-mock";
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
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  if (!text) return NextResponse.json({ error: "請先輸入一段文字" }, { status: 400 });

  const userId = new ObjectId(user.id);

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
