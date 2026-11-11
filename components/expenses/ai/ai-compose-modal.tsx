"use client";

import { useRef, useState } from "react";
import { Modal } from "../modal";
import { Button } from "../button";
import { TransactionModal, type TransactionModalDraft } from "../transaction-modal";
import { text } from "../theme";
import { useToast } from "../toast";
import { AiDraftList } from "./ai-draft-list";
import { useAiKey } from "./use-ai-key";
import { useSpeechInput } from "./use-speech-input";
import { splitSpokenEntries } from "./split-spoken";
import { scanInvoiceQr } from "./scan-invoice-qr";
import type { CategoryDTO } from "@/lib/expenses/categories";
import { unclassifiedItems, type AiDraftDTO, type AiDraftItemDTO } from "@/lib/expenses/ai-drafts";
import type { TransactionDTO } from "@/lib/expenses/transactions";
import type { AccountDTO } from "@/lib/expenses/accounts";
import type { AccountTypeDTO } from "@/lib/expenses/account-types";
import type { TransferDTO } from "@/lib/expenses/transfers";

/** AI 記帳的主彈窗：上面打一句話，解析完同一個彈窗往下長出待確認清單。
 *
 *  輸入跟確認放在同一個彈窗、不分兩頁，是因為這整件事該在十幾秒內結束——中間換頁會讓
 *  「我剛剛打了什麼」離開視線，而確認的時候最需要對照的就是原句。
 *
 *  **沒有支出／收入分頁**：收支方向由「配到哪個分類」決定。先叫使用者自己宣告是支出還是
 *  收入，等於在用 AI 之前先做一次分類判斷，那正是這個功能要替他做的事；而且多一個要
 *  宣告的東西就多一個會弄錯的地方。判錯了在待確認區點進去改，那裡的分頁切換還在。
 *
 *  解析結果一產生就已經存進資料庫了（見 /api/expenses/ai/parse），所以這個彈窗關掉、
 *  甚至整個瀏覽器關掉，那一批都還在，可以從設定頁的「AI 待確認」回來處理。 */
export function AiComposeModal({
  open,
  categories,
  accounts,
  accountTypes,
  transactions,
  transfers,
  onClose,
  onCommitted,
  onCategoriesChange,
  onOpenKeyModal,
}: {
  open: boolean;
  categories: CategoryDTO[];
  accounts: AccountDTO[];
  accountTypes: AccountTypeDTO[];
  transactions: TransactionDTO[];
  transfers: TransferDTO[];
  onClose: () => void;
  /** 寫入成功後把最新的交易清單交回去，呼叫端更新自己的畫面。 */
  onCommitted: (transactions: TransactionDTO[]) => void;
  onCategoriesChange: (categories: CategoryDTO[]) => void;
  onOpenKeyModal: () => void;
}) {
  const showToast = useToast();
  const { hasKey } = useAiKey();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<AiDraftDTO | null>(null);
  /** 正在編輯的那一筆（null ＝ 沒有在編）。 */
  const [editing, setEditing] = useState<AiDraftItemDTO | null>(null);

  // 語音輸入：收完音把整段話接到輸入框後面（不是蓋掉）——使用者可能先打了幾筆、再用講的
  // 補後面那幾筆。接的時候補一個逗號，解析那邊本來就用逗號斷句。
  const speech = useSpeechInput({
    // 口述沒有標點，所以先照金額切成一筆一筆再填進來（見 splitSpokenEntries）——
    // 「晚餐150元看電影300元」直接變成兩行，不用使用者自己回去加逗號。
    onResult: (spoken) => {
      const parts = splitSpokenEntries(spoken);
      setInput((prev) => [prev.trim(), ...parts].filter(Boolean).join("\n"));
    },
    onError: showToast,
  });

  // 掃發票：選完檔就直接處理，不另外做預覽畫面——使用者要的是「記好這筆帳」，
  // 不是看自己拍的照片。
  const fileRef = useRef<HTMLInputElement>(null);

  async function scanInvoice(file: File) {
    setBusy(true);
    setError(null);
    const invoice = await scanInvoiceQr(file).catch(() => null);
    if (!invoice) {
      setBusy(false);
      setError("這張圖裡找不到統一發票的 QR code。拍的時候讓兩個方塊都清楚入鏡，或改用上面的文字／語音輸入。");
      return;
    }
    const res = await fetch("/api/expenses/ai/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoice }),
    }).catch(() => null);
    const data: { draft?: AiDraftDTO; error?: string; reused?: boolean } = (await res?.json().catch(() => ({}))) ?? {};
    setBusy(false);
    if (!data.draft) {
      setError(data.error ?? "發票解析失敗，再試一次");
      return;
    }
    setDraft(data.draft);
    if (data.reused) showToast("這張發票剛剛掃過了，直接沿用上一批");
  }

  const unclassified = draft ? unclassifiedItems(draft) : [];
  const pending = draft?.items.filter((i) => i.state === "pending") ?? [];

  function reset() {
    setInput("");
    setDraft(null);
    setError(null);
    setEditing(null);
  }

  async function parse() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/expenses/ai/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input }),
    }).catch(() => null);
    const data: { draft?: AiDraftDTO; error?: string; reused?: boolean } = (await res?.json().catch(() => ({}))) ?? {};
    setBusy(false);
    if (!data.draft) {
      setError(data.error ?? "解析失敗，再試一次");
      return;
    }
    setDraft(data.draft);
    if (data.reused) showToast("這段文字剛剛解析過了，直接沿用上一批");
  }

  async function patchItem(key: string, patch: Record<string, unknown>) {
    if (!draft) return;
    const data: { draft?: AiDraftDTO } = await fetch("/api/expenses/ai/drafts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId: draft.id, key, ...patch }),
    })
      .then((r) => r.json())
      .catch(() => ({}));
    if (data.draft) setDraft(data.draft);
  }

  async function commit() {
    if (!draft) return;
    setBusy(true);
    const data: { count?: number; transactions?: TransactionDTO[]; error?: string } = await fetch("/api/expenses/ai/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "commit", draftId: draft.id }),
    })
      .then((r) => r.json())
      .catch(() => ({}));
    setBusy(false);
    if (!data.transactions) {
      setError(data.error ?? "寫入失敗，再試一次");
      return;
    }
    onCommitted(data.transactions);
    showToast(`已寫入 ${data.count ?? 0} 筆`);
    reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="AI 記帳"
      fullHeight
      footer={
        draft ? (
          <div className="flex w-full items-center justify-between gap-2">
            <button type="button" onClick={reset} className="text-xs font-medium text-[#9C94C4]">
              重新輸入
            </button>
            <Button disabled={busy || pending.length === 0 || unclassified.length > 0} onClick={commit}>
              {busy ? "寫入中…" : `寫入 ${pending.length} 筆`}
            </Button>
          </div>
        ) : (
          <div className="flex w-full justify-end">
            <Button disabled={busy || input.trim().length === 0} onClick={parse}>
              {busy ? "解析中…" : "解析"}
            </Button>
          </div>
        )
      }
    >
      {!draft && (
        <>
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={4}
              placeholder="午餐全家便當 120，晚上跟朋友看電影 350"
              // 右邊留出麥克風那顆按鈕的位置（pr-14），不然打字會跑到按鈕底下。
              className="w-full resize-none rounded-2xl border border-[#ECE4FA] bg-white py-3 pl-4 pr-14 text-sm text-[#4A3B7C] outline-none placeholder:text-[#B3ABD4] focus:border-[#6F5FD6]"
            />
            {/* 瀏覽器不支援語音辨識時整顆不顯示（見 useSpeechInput 的說明）——留一顆按了
                沒反應的按鈕比沒有更糟。 */}
            {speech.supported && (
              <button
                type="button"
                onClick={speech.listening ? speech.stop : speech.start}
                aria-label={speech.listening ? "停止收音" : "用說的輸入"}
                title={speech.listening ? "停止收音" : "用說的輸入"}
                className={`absolute right-3 top-3 grid size-9 place-items-center rounded-full text-base transition-colors ${
                  // 收音中換成紅色方塊＋呼吸效果：麥克風開著是會讓人介意的狀態，要一眼看得出來。
                  speech.listening ? "animate-pulse bg-[#D1517E] text-white" : "bg-[#F3EFFC] text-[#6F5FD6]"
                }`}
              >
                {speech.listening ? "■" : "🎤"}
              </button>
            )}
          </div>
          {speech.listening && <p className={`-mt-1 ${text.muted}`}>聆聽中…講完按一下紅色按鈕。講到金額就算一筆，「晚餐150元看電影300元」會自動分成兩筆。</p>}
          <p className={`${text.faint} leading-relaxed`}>
            一次最多 20 筆。用逗號或換行分開每一筆，日期可以講「昨天」「前天」，沒講就當作今天。收入或支出會看分類自己判斷。
          </p>

          {/* 掃發票：走統一發票上的 QR code，不是對照片做文字辨識——QR 裡本來就有金額跟
              日期，是讀出來的不是認出來的，而且整段解碼都在瀏覽器裡跑完，照片不會上傳。 */}
          <div className="flex flex-col gap-1.5 rounded-2xl border border-[#ECE4FA] bg-[#FBF9FE] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className={`block ${text.body}`}>掃統一發票</span>
                <span className={`block ${text.muted}`}>金額跟日期直接從發票的 QR code 讀出來</span>
              </span>
              <Button variant="ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? "讀取中…" : "選照片"}
              </Button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              // capture 讓手機直接開後鏡頭拍；電腦上瀏覽器會忽略它，變成一般的選檔。
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                // 清掉 value：同一張照片連選兩次時 onChange 不會再觸發（value 沒變）。
                e.target.value = "";
                if (file) void scanInvoice(file);
              }}
            />
          </div>
          {/* 沒金鑰不擋著不讓用——目前本來就是模擬解析。但要讓人找得到設定的地方。 */}
          <button type="button" onClick={onOpenKeyModal} className="self-start text-xs font-medium text-[#6F5FD6]">
            {hasKey ? "已設定 API Key，點這裡更換" : "目前是模擬解析 · 設定 API Key"}
          </button>
        </>
      )}

      {draft && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className={text.sectionHeading}>待確認 {pending.length} 筆</p>
            <span className={text.faint}>{draft.model === "mock" ? "模擬解析" : draft.model}</span>
          </div>
          <p className={`-mt-1 ${text.muted} leading-relaxed`}>「{draft.inputSummary}」</p>

          <AiDraftList
            draft={draft}
            categories={categories}
            onEdit={setEditing}
            onSkip={(item) => patchItem(item.key, { state: "skipped" })}
          />

          {unclassified.length > 0 && (
            <p className="rounded-2xl bg-[#FDF4E7] px-4 py-3 text-xs leading-relaxed text-[#9A7430]">
              還有 {unclassified.length} 筆沒分類，點那一列補上之後才能寫入。不想記的話按「略過」。
            </p>
          )}
        </>
      )}

      {error && <p className="rounded-2xl bg-[#FDEEF0] px-4 py-3 text-xs leading-relaxed text-[#D1517E]">{error}</p>}

      {/* 編輯用的是記帳本原本那個新增／編輯彈窗——分類、名稱、日期、金額、帳戶全部都在，
          而且值已經帶好。不要為了草稿另外刻一份只能改分類的簡化版：使用者看到 AI 把金額
          認錯時，會想當場改掉，而不是先寫進去再去明細頁改一次。
          標題換掉：這一批還不是真的紀錄，寫「編輯收支紀錄」會讓人以為已經進帳本了。 */}
      <TransactionModal
        key={editing ? editing.key : "closed"}
        open={editing !== null}
        title="確認這一筆"
        confirmLabel="改好了"
        categories={categories}
        accounts={accounts}
        accountTypes={accountTypes}
        transactions={transactions}
        transfers={transfers}
        defaultKind="支出"
        initial={
          editing
            ? {
                // 沒分類就帶 AI 判到的大分類（見 ai-mock 的 hint）：CategoryGridPicker 會
                // 自動展開那一類的「項目」那一排，使用者點一下就好。
                categoryId: editing.categoryId ?? editing.categoryHintId ?? "",
                amount: editing.amount,
                date: editing.date,
                note: editing.note,
                accountId: editing.accountId,
              }
            : undefined
        }
        onClose={() => setEditing(null)}
        onSave={(next: TransactionModalDraft) => {
          if (editing) {
            patchItem(editing.key, {
              categoryId: next.categoryId,
              amount: next.amount,
              date: next.date,
              note: next.note ?? null,
              accountId: next.accountId ?? null,
            });
          }
          setEditing(null);
        }}
        onCategoriesChange={onCategoriesChange}
      />
    </Modal>
  );
}
