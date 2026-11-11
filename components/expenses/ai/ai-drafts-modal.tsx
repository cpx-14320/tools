"use client";

import { useState } from "react";
import { Modal } from "../modal";
import { Button } from "../button";
import { IconAvatar } from "../icon-avatar";
import { ICON_PATHS } from "../icon-paths";
import { ListCard } from "../list-row";
import { ConfirmModal } from "../confirm-modal";
import { TransactionModal, type TransactionModalDraft } from "../transaction-modal";
import { text } from "../theme";
import { useToast } from "../toast";
import { useBusy } from "../busy";
import { SelectionDot } from "../selection-bar";
import { AiDraftList } from "./ai-draft-list";
import { useDraftEditData } from "./use-draft-edit-data";
import { draftSummaryLine, pendingItems, unclassifiedItems, type AiDraftDTO, type AiDraftItemDTO } from "@/lib/expenses/ai-drafts";
import type { CategoryDTO } from "@/lib/expenses/categories";
import { formatDate } from "@/lib/format";

/** 設定頁的「待確認的解析結果」——先看有哪幾批，點進去處理其中一批。
 *
 *  兩層而不是一層：同一句話重跑兩次會產生兩批很像的結果，直接把所有項目混在一起列的話
 *  根本分不出哪筆屬於哪次解析，更不可能判斷「哪一批已經處理過了」。批次是這個功能的
 *  基本單位，介面要照著它走。 */
export function AiDraftsModal({
  open,
  drafts,
  categories,
  onClose,
  onDraftsChange,
}: {
  open: boolean;
  drafts: AiDraftDTO[];
  categories: CategoryDTO[];
  onClose: () => void;
  onDraftsChange: (drafts: AiDraftDTO[]) => void;
}) {
  const showToast = useToast();
  const runBusy = useBusy();
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AiDraftItemDTO | null>(null);
  const [busy, setBusy] = useState(false);
  // 第一層清單的多選。跟「最近刪除」同一套：整列就是勾選目標，底下那排按鈕對勾起來的
  // 那幾批做事——一批一批點進去刪，重跑過好幾次的時候要點很多輪。
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteBatch, setDeleteBatch] = useState(false);
  // 編輯一筆草稿要用到帳戶、交易、轉帳（新增／編輯彈窗裡的帳戶選擇要顯示餘額）。
  // 這些刻意不從設定頁的 Server Component 傳下來——那會讓每次進設定頁都多載一份完整的
  // 交易清單（量過大約 80KB），只為了一個多數時候不會打開的彈窗。改成真的打開才抓。
  const editData = useDraftEditData(openId !== null, categories);

  const current = openId ? (drafts.find((d) => d.id === openId) ?? null) : null;
  const pendingDrafts = drafts.filter((d) => d.status === "pending" && pendingItems(d).length > 0);
  const chosen = pendingDrafts.filter((d) => selected.has(d.id));
  const allSelected = pendingDrafts.length > 0 && pendingDrafts.every((d) => selected.has(d.id));
  // 勾起來的裡面只要有一批還有沒分類的項目就不給按：commit 只會寫「已經有分類」的那幾筆，
  // 卻會把整批標成 committed（見 ai-drafts.server.ts 的 closeAiDraft），沒分類的那幾筆就
  // 這樣不見了。進詳情頁把它分完類再回來勾，不讓這種半吊子的寫入發生。
  const chosenHasUnclassified = chosen.some((d) => unclassifiedItems(d).length > 0);

  /** 關掉彈窗時把勾選清掉：下次打開要是乾淨的（理由同 trash-modal 的 close）。 */
  function close() {
    setSelected(new Set());
    onClose();
  }

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    const data: { drafts?: AiDraftDTO[]; count?: number; error?: string } = await fetch("/api/expenses/ai/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .catch(() => ({}));
    setBusy(false);
    if (data.drafts) onDraftsChange(data.drafts);
    return data;
  }

  async function patchItem(key: string, patch: Record<string, unknown>) {
    if (!current) return;
    const data: { draft?: AiDraftDTO } = await fetch("/api/expenses/ai/drafts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId: current.id, key, ...patch }),
    })
      .then((r) => r.json())
      .catch(() => ({}));
    if (data.draft) onDraftsChange(drafts.map((d) => (d.id === data.draft!.id ? data.draft! : d)));
  }

  /** 批次確認：勾起來的那幾批逐批寫入消費紀錄。跟批次刪除同一個寫法——API 一次只收
   *  一個 draftId，每次都回傳最新的完整清單。 */
  async function confirmChosen() {
    const targets = chosen;
    await runBusy("寫入中…", async () => {
      let total = 0;
      for (const d of targets) total += (await post({ action: "commit", draftId: d.id })).count ?? 0;
      showToast(`已寫入 ${total} 筆`);
    });
    setSelected(new Set());
  }

  // ── 第二層：處理其中一批 ──────────────────────────────────────────────────
  if (current) {
    const unclassified = unclassifiedItems(current);
    return (
        <Modal
          open={open}
          onClose={() => setOpenId(null)}
          title="待確認"
          fullHeight
          // 這一層只負責「看、調整、略過」，寫入統一在上一層做（勾選＋確認）。本來這裡
          // 有一顆「寫入 N 筆」，跟上一層的確認是同一件事卻用不同的字、放在不同的地方，
          // 使用者得記兩套；而且一批一批點進去寫，重跑過好幾次的時候要點很多輪。
        >
          {/* 標題就是當初打進去的那句話——使用者認得的是自己寫的字，不是日期或模型名稱。
              本來底下還有一行「日期 · 模擬解析 · N 筆待確認 · N 筆未分類」，那些數字在
              下面的清單裡一筆一筆都看得到，重複寫一次只是把開頭墊高。 */}
          <p className={text.sectionHeading}>「{current.inputSummary}」</p>

          <AiDraftList
            draft={current}
            categories={categories}
            onEdit={setEditing}
            onSkip={(item) => patchItem(item.key, { state: "skipped" })}
          />

          {unclassified.length > 0 && (
            <p className="rounded-2xl bg-[#FDF4E7] px-4 py-3 text-xs leading-relaxed text-[#9A7430]">
              還有 {unclassified.length} 筆沒分類，點那一列補上之後才能寫入。不想記的話按「略過」。
            </p>
          )}

          {/* 編輯用的是記帳本原本那個新增／編輯彈窗（跟 AI 記帳彈窗裡同一個），分類、
              名稱、日期、金額、帳戶全都能改，而且值已經帶好。 */}
          <TransactionModal
            key={editing ? editing.key : "closed"}
            open={editing !== null}
            title="確認這一筆"
            confirmLabel="改好了"
            categories={editData.categories}
            accounts={editData.accounts}
            accountTypes={editData.accountTypes}
            transactions={editData.transactions}
            transfers={editData.transfers}
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
            onCategoriesChange={editData.setCategories}
          />
        </Modal>
    );
  }

  // ── 第一層：有哪幾批 ─────────────────────────────────────────────────────
  return (
    <Modal
      open={open}
      onClose={close}
      title="待確認的解析結果"
      // 滿版＋標題與底部固定，跟「最近刪除」同一種版型：兩個都是「一長串待處理的項目，
      // 一邊捲一邊挑」。本來是跟著內容長高的彈窗，批次一多就整個頂到畫面外，而關閉鍵
      // 在最底下——要關掉得先捲到底。
      fullHeight
      // 本來左邊還有一顆「清掉已處理的」：這份清單只列還沒處理完的，那顆按鈕動到的是
      // 畫面上根本看不到的東西，按下去唯一的回饋是一句「已清掉 N 批」——使用者無從判斷
      // 清掉了什麼。已經寫進消費紀錄的批次留在資料庫裡也不影響任何畫面，所以整顆移除。
      footer={
        // 左下角是破壞性動作、右下角是離開＋主要動作，跟「最近刪除」同一種排法：
        // 永久刪除／刪除放文字連結，還原／確認放實心按鈕。沒勾任何一批時都是停用狀態；
        // 勾到的裡面有還沒分類完的，確認也不給按（見 chosenHasUnclassified）。
        <div className="flex w-full items-center justify-between gap-2">
          <button
            type="button"
            disabled={chosen.length === 0}
            onClick={() => setDeleteBatch(true)}
            className="text-xs font-medium text-[#D1517E] disabled:opacity-40"
          >
            刪除
          </button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={close}>
              關閉
            </Button>
            <Button disabled={chosen.length === 0 || chosenHasUnclassified || busy} onClick={confirmChosen}>
              確認
            </Button>
          </div>
        </div>
      }
    >
      {pendingDrafts.length === 0 ? (
        <p className={`px-1 ${text.faint}`}>目前沒有待確認的解析結果。</p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className={`${text.muted} leading-relaxed`}>每一筆是一次解析的結果，點進去可以調整。</p>
            {/* 勾選是為了「批次刪除」用的，點列本身還是進去處理那一批——兩個都是常用
                動作，所以勾選框另外給一個點擊區，不像最近刪除那樣整列都是勾選。 */}
            <button
              type="button"
              onClick={() => setSelected(allSelected ? new Set() : new Set(pendingDrafts.map((d) => d.id)))}
              className="shrink-0 text-xs font-medium text-[#6F5FD6]"
            >
              {allSelected ? "取消全選" : "全選"}
            </button>
          </div>
          <ListCard>
            {pendingDrafts.map((d) => (
              <div key={d.id} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={selected.has(d.id)}
                  aria-label={`選取「${d.inputSummary}」`}
                  onClick={() =>
                    setSelected((set) => {
                      const next = new Set(set);
                      if (next.has(d.id)) next.delete(d.id);
                      else next.add(d.id);
                      return next;
                    })
                  }
                  className="shrink-0"
                >
                  <SelectionDot selected={selected.has(d.id)} />
                </button>
                <button type="button" onClick={() => setOpenId(d.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                {/* 本來是 📄／💬 兩個 emoji 分 CSV 跟打字輸入，但使用者在這一頁要挑的是
                    「哪一批還沒確認」，不是「它當初從哪裡來」——來源在點進去的詳情裡看得到。
                    統一換成帳單圖，跟清單其他列的圖示同一套畫風。 */}
                <IconAvatar icon={ICON_PATHS.aiDraftItem} plain />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate ${text.body}`}>{d.inputSummary}</span>
                  <span className={`block ${text.muted}`}>
                    {formatDate(d.createdAt.slice(0, 10))} · {draftSummaryLine(d)}
                  </span>
                </span>
                {unclassifiedItems(d).length > 0 && (
                  <span className="shrink-0 rounded-full bg-[#FDF4E7] px-2 py-0.5 text-xs font-semibold text-[#9A7430]">待分類</span>
                )}
                <span className={text.faint}>›</span>
                </button>
              </div>
            ))}
          </ListCard>
        </>
      )}

      {/* 按鈕寫「刪除」就真的刪掉（API 的 delete），不是標成不處理的 discard——後者會
          把文件永遠留在資料庫裡、畫面上又看不到，使用者以為刪掉了其實沒有。
          不進垃圾桶：這是還沒寫進消費紀錄的暫存解析結果，重跑一次就有，救它不划算
          （跟存錢目標、固定收支同一個判斷）。 */}
      <ConfirmModal
        open={deleteBatch}
        title={chosen.length > 1 ? `刪除 ${chosen.length} 批` : "刪除這一批"}
        message={`勾起來的${chosen.length > 1 ? `這 ${chosen.length} 批` : "這一批"}解析結果會被刪掉，不會寫進消費紀錄，也不會進「最近刪除」。已經寫入的那幾筆不受影響。`}
        confirmLabel="刪除"
        onConfirm={async () => {
          // 逐批送出：API 一次只收一個 draftId，而且每次都回傳最新的完整清單。
          await runBusy("刪除中…", async () => {
            for (const d of chosen) await post({ action: "delete", draftId: d.id });
          });
          setSelected(new Set());
          showToast(`已刪除 ${chosen.length} 批`);
        }}
        onClose={() => setDeleteBatch(false)}
      />
    </Modal>
  );
}
