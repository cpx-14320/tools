"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconAvatar } from "@/components/expenses/icon-avatar";
import { ICON_PATHS } from "@/components/expenses/icon-paths";
import { ListCard } from "@/components/expenses/list-row";
import { PageHeader } from "@/components/expenses/page-header";
import { StickyToolbar } from "@/components/expenses/sticky-toolbar";
import { SelectionBar, SelectionDot } from "@/components/expenses/selection-bar";
import { ConfirmModal } from "@/components/expenses/confirm-modal";
import { text } from "@/components/expenses/theme";
import { useToast } from "@/components/expenses/toast";
import { useBusy } from "@/components/expenses/busy";
import { draftSummaryLine, pendingItems, unclassifiedItems, type AiDraftDTO } from "@/lib/expenses/ai-drafts";
import { formatDate } from "@/lib/format";

/** 「設定 › 待確認的解析結果」——先看有哪幾批，點進去處理其中一批。
 *
 *  **兩層而不是一層**：同一句話重跑兩次會產生兩批很像的結果，直接把所有項目混在一起列的話
 *  根本分不出哪筆屬於哪次解析，更不可能判斷「哪一批已經處理過了」。批次是這個功能的基本
 *  單位，介面要照著它走。
 *
 *  **為什麼兩層都是頁面、不是彈窗**：以前第一層是彈窗、第二層再疊一個彈窗，編輯單筆時還
 *  要再疊第三個，手機的返回手勢一按就把整個記帳本退掉。改成 `/more/ai-drafts` 跟
 *  `/more/ai-drafts/[id]` 兩頁之後，返回就是回上一層，而且編輯那個彈窗要用到的帳戶、
 *  交易資料可以在詳情頁的伺服器端先讀好，不用再從瀏覽器補抓一輪。 */
export function AiDraftsView({ initialDrafts }: { initialDrafts: AiDraftDTO[] }) {
  const router = useRouter();
  const showToast = useToast();
  const runBusy = useBusy();
  const [drafts, setDrafts] = useState(initialDrafts);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteBatch, setDeleteBatch] = useState(false);

  const pendingDrafts = drafts.filter((d) => d.status === "pending" && pendingItems(d).length > 0);
  const chosen = pendingDrafts.filter((d) => selected.has(d.id));
  // 勾起來的裡面只要有一批還有沒分類的項目就不給按：commit 只會寫「已經有分類」的那幾筆，
  // 卻會把整批標成 committed（見 ai-drafts.server.ts 的 closeAiDraft），沒分類的那幾筆就
  // 這樣不見了。進詳情頁把它分完類再回來勾，不讓這種半吊子的寫入發生。
  const chosenHasUnclassified = chosen.some((d) => unclassifiedItems(d).length > 0);

  async function post(body: Record<string, unknown>) {
    const data: { drafts?: AiDraftDTO[]; count?: number; error?: string } = await fetch("/api/expenses/ai/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .catch(() => ({}));
    if (data.drafts) setDrafts(data.drafts);
    return data;
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
    // 寫進去的是真的交易，別頁（首頁、明細）的數字要跟著變。
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 標題不進釘住的區塊：底下那條工具列已經佔一列，標題再擠進去就要換行（這一頁的
          標題有八個字，不像「最近刪除」那樣塞得下旁邊還有東西）。 */}
      <PageHeader flush title="待確認的解析結果" help="每一批是一次 AI 解析的結果。點進去可以逐筆調整分類或略過，勾起來按「確認」才會寫進消費紀錄。" />

      {pendingDrafts.length === 0 ? (
        <p className={`px-1 ${text.faint}`}>目前沒有待確認的解析結果。</p>
      ) : (
        <>
          <StickyToolbar>
            {/* 跟其他清單頁同一顆選取工具列：左邊全選＋已選幾批，右邊確認（淡紫膠囊）
                跟刪除（紅字）。這一頁永遠處在選取狀態，所以沒有「選取」開關。 */}
            <SelectionBar
              count={chosen.length}
              total={pendingDrafts.length}
              unit="批"
              actions={[{ label: "確認", onClick: () => void confirmChosen(), disabled: chosenHasUnclassified }]}
              onToggleAll={() => setSelected(chosen.length === pendingDrafts.length ? new Set() : new Set(pendingDrafts.map((d) => d.id)))}
              onDelete={() => setDeleteBatch(true)}
            />
          </StickyToolbar>

          {chosenHasUnclassified && (
            <p className="rounded-2xl bg-[#FDF4E7] px-4 py-3 text-xs leading-relaxed text-[#9A7430]">
              勾起來的批次裡還有沒分類的項目，確認會把那幾筆漏掉。點進去補上分類，或是把那一筆略過。
            </p>
          )}

          <ListCard>
            {pendingDrafts.map((d) => (
              <div key={d.id} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                {/* 勾選是為了批次確認／刪除用的，點列本身是進去處理那一批——兩個都是常用
                    動作，所以勾選框另外給一個點擊區，不像最近刪除那樣整列都是勾選。 */}
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
                <Link href={`/tools/expenses/more/ai-drafts/${d.id}`} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  {/* 本來是 📄／💬 兩個 emoji 分 CSV 跟打字輸入，但使用者在這一頁要挑的是
                      「哪一批還沒確認」，不是「它當初從哪裡來」——來源在點進去的詳情裡看得到。 */}
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
                </Link>
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
    </div>
  );
}
