"use client";

import { useState } from "react";
import { TOAST, useToast } from "@/components/expenses/toast";
import { useUndoDelete } from "@/components/expenses/use-undo-delete";
import { PageHeader } from "@/components/expenses/page-header";
import { StickyToolbar } from "@/components/expenses/sticky-toolbar";
import { FloatingAddButton } from "@/components/expenses/floating-add-button";
import { text } from "@/components/expenses/theme";
import { AccountTypeModal, type AccountTypeModalDraft } from "@/components/expenses/account-type-modal";
import { AccountTypeBatchModal, type AccountTypeBatchItem } from "@/components/expenses/account-type-batch-modal";
import { ConfirmModal } from "@/components/expenses/confirm-modal";
import { SelectionBar, SelectionDot, SelectionToggle, useSelection } from "@/components/expenses/selection-bar";
import { SortArrows, SortToggle } from "@/components/expenses/sort-controls";
import { ListCard, ListRow } from "@/components/expenses/list-row";
import { useBusy } from "@/components/expenses/busy";
import { TRASH_RESTORE_NOTE } from "@/lib/expenses/trash";
import { accountTypesByKind, type AccountTypeDTO } from "@/lib/expenses/account-types";
import { categoryColorClass } from "@/lib/expenses/categories";

/** 帳戶類型頁。
 *
 *  類型清單跟帳戶清單都是 page.tsx 在伺服器上讀好傳進來的，所以沒有「載入中」這個狀態，
 *  也不需要骨架：第一次畫出來就是有資料的畫面。 */
export function AccountTypesView({
  initialAccountTypes,
}: {
  initialAccountTypes: AccountTypeDTO[];
}) {
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>(initialAccountTypes);
  const showToast = useToast();
  const showDeleteToast = useUndoDelete();
  const [modal, setModal] = useState<AccountTypeDTO | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  // 擋下來的理由（刪不掉、或資產/負債換不了）直接存成一句話——兩種情況的說明不一樣，
  // 存 inUseCount 再在畫面上拼字串的話只能講刪除那一種。
  const [blockedInfo, setBlockedInfo] = useState<{ message: string } | null>(null);
  // 批次刪除的確認。單筆刪除走編輯彈窗的 ModalFooter，它本來就會問一次；批次以前是
  // 按下去就直接刪，兩條路一問一不問，所以這裡補上同一道關卡。
  const [deleteConfirm, setDeleteConfirm] = useState<string[] | null>(null);
  const runBusy = useBusy();
  // 排序模式：每一列右邊長出 ↑↓。跟多選模式互斥（理由同收支分類頁）。
  const [sorting, setSorting] = useState(false);

  async function handleSave(draft: AccountTypeModalDraft) {
    if (!modal) return;
    const data: { accountTypes?: AccountTypeDTO[]; error?: string } = await fetch("/api/expenses/account-types", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: modal.id, ...draft }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    // 伺服器會擋下「底下還有帳戶卻想換資產/負債」，把理由顯示出來、彈窗留著讓人改回去。
    if (data.error) {
      setBlockedInfo({ message: data.error });
      return;
    }
    if (data.accountTypes) setAccountTypes(data.accountTypes);
    showToast(TOAST.saved);
    setModal(null);
  }

  // 刪除類型沒有「未分類」這種通用歸宿可以自動改掛（見 account-types.server.ts 的
  // 說明），所以這裡不是問「要不要強制刪除」，查到還有帳戶在用就直接擋下、告知筆數，
  // 使用者要先把那些帳戶改到別的類型才能刪除。
  async function tryDeleteTypes(ids: string[]) {
    let latest = accountTypes;
    let totalInUse = 0;
    let blockedCount = 0;
    const trashIds: (string | undefined)[] = [];
    for (const id of ids) {
      const res = await fetch(`/api/expenses/account-types?id=${id}`, { method: "DELETE" }).catch(() => null);
      if (!res) continue;
      const data: { accountTypes?: AccountTypeDTO[]; inUseCount?: number; trashId?: string } = await res.json().catch(() => ({}));
      if (res.status === 409) {
        blockedCount++;
        totalInUse += data.inUseCount ?? 0;
      } else if (data.accountTypes) {
        latest = data.accountTypes;
        trashIds.push(data.trashId);
      }
    }
    setAccountTypes(latest);
    // 被擋下的（底下還有帳戶在用）不算刪掉了，只報真的刪掉的那幾筆。
    const deleted = ids.length - blockedCount;
    if (deleted > 0) {
      showDeleteToast(
        trashIds,
        async () => {
          const fresh: { accountTypes?: AccountTypeDTO[] } = await fetch("/api/expenses/account-types").then((r) => r.json());
          if (fresh.accountTypes) setAccountTypes(fresh.accountTypes);
        },
        deleted === 1 ? TOAST.deleted : `已刪除 ${deleted} 筆`,
      );
    }
    return { blockedCount, totalInUse };
  }

  async function handleDelete() {
    if (!modal) return;
    // 單筆刪除也要有「處理中」：以前只有批次那條路有，單筆按下去畫面完全沒反應。
    const { blockedCount, totalInUse } = await runBusy("刪除中…", () => tryDeleteTypes([modal.id]));
    setModal(null);
    if (blockedCount > 0) setBlockedInfo({ message: `還有 ${totalInUse} 個帳戶掛著選取的類型，無法刪除。請先把這些帳戶改成別的類型，再回來刪除。` });
  }

  function handleBulkDelete() {
    if (selection.selectedIds.size === 0) return;
    setDeleteConfirm([...selection.selectedIds]);
  }

  async function confirmBulkDelete() {
    if (!deleteConfirm) return;
    const { blockedCount, totalInUse } = await runBusy("刪除中…", () => tryDeleteTypes(deleteConfirm));
    setDeleteConfirm(null);
    selection.exit();
    if (blockedCount > 0) setBlockedInfo({ message: `還有 ${totalInUse} 個帳戶掛著選取的類型，無法刪除。請先把這些帳戶改成別的類型，再回來刪除。` });
  }

  // 批次新增：逐筆依序 POST（不是 Promise.all 併發），理由跟分類批次新增一樣——
  // createAccountType 的 order 是用當下已存在筆數算出來的，併發送出會拿到同一個 order。
  async function handleBatchSave(items: AccountTypeBatchItem[]) {
    let latest = accountTypes;
    for (const item of items) {
      const data: { accountTypes?: AccountTypeDTO[] } = await fetch("/api/expenses/account-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (data.accountTypes) latest = data.accountTypes;
    }
    setAccountTypes(latest);
    showToast(items.length === 1 ? TOAST.created : `已新增 ${items.length} 筆`);
    setBatchOpen(false);
  }

  const assetTypes = accountTypesByKind(accountTypes, "asset");
  const liabilityTypes = accountTypesByKind(accountTypes, "liability");
  const selection = useSelection(accountTypes.map((t) => t.id));

  /** 把 group（資產或負債其中一段）裡第 index 筆往上／往下移一格。
   *
   *  跟收支分類頁同一套：先改本地畫面再送出，送的是那一段排好的完整 id 順序。
   *  資產跟負債各自是一段，不會互相跨越——要換邊是改類型本身的資產/負債，不是排序。 */
  async function move(group: AccountTypeDTO[], index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= group.length) return;
    const nextGroup = [...group];
    [nextGroup[index], nextGroup[target]] = [nextGroup[target], nextGroup[index]];
    const nextIds = nextGroup.map((t) => t.id);

    // accountTypes 這個陣列本身就是顯示順序（伺服器已照 kind+order 排好），本地端要
    // 立刻反映只要把這一段原本佔的那幾個位置按新順序填回去。
    const positions = group.map((g) => accountTypes.findIndex((t) => t.id === g.id)).sort((a, b) => a - b);
    const byId = new Map(accountTypes.map((t) => [t.id, t]));
    const nextAll = [...accountTypes];
    nextIds.forEach((id, i) => {
      const found = byId.get(id);
      if (found) nextAll[positions[i]] = found;
    });
    setAccountTypes(nextAll);

    const data: { accountTypes?: AccountTypeDTO[] } = await fetch("/api/expenses/account-types/order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: nextIds }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.accountTypes) setAccountTypes(data.accountTypes);
  }

  /** 資產／負債各一段：小標、清單，每一列是「類型名稱＋底下掛了幾個帳戶」。 */
  function section(title: string, types: AccountTypeDTO[]) {
    if (types.length === 0) return null;
    return (
      <div>
        <p className={`mb-2 px-1 ${text.sectionHeading}`}>{title}</p>
        {/* 只有圖示跟名稱，右邊不掛任何數字：這一頁是管理類型本身（名稱、圖示、顏色、
            資產還是負債），那是跟月份無關的定義。「這個類型有多少錢、佔多少比例」是
            分析，在資產總表看（那裡有月份、佔比進度條，還連著底下是哪幾個帳戶）。 */}
        <ListCard>
          {types.map((t, i) => (
            <ListRow
              key={t.id}
              icon={t.icon}
              iconClassName={categoryColorClass[t.color]}
              name={t.name}
              // 排序模式下右邊長出 ↑↓，只在自己這一段（資產或負債）裡面移動。
              right={
                sorting ? (
                  <SortArrows
                    onUp={() => move(types, i, -1)}
                    onDown={() => move(types, i, 1)}
                    canUp={i > 0}
                    canDown={i < types.length - 1}
                  />
                ) : undefined
              }
              leading={selection.selecting ? <SelectionDot selected={selection.selectedIds.has(t.id)} /> : undefined}
              onClick={sorting ? undefined : () => (selection.selecting ? selection.toggle(t.id) : setModal(t))}
            />
          ))}
        </ListCard>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 標題跟排序／選取排同一列，整塊一起釘在卡片頂端（見 StickyToolbar）。
          分成「標題一列、按鈕一列」的話，按鈕那列左邊整片空著，還白白多佔一列高度——
          這一頁右邊只有兩顆按鈕，併成一列剛好。
          新增搬到右下角的浮動按鈕（跟首頁新增交易同一招）：按鈕一多擠一列在手機上會
          換行成兩排，很難看也很難點。常見類型現在是第一次進記帳本時就自動建好的
          （見 lib/expenses/presets.server.ts），不再需要套用按鈕。 */}
      <StickyToolbar>
        <PageHeader
          flush
          title="帳戶類型"
          // 這一頁現在是從「設定」進來的，標題列不再掛「返回資產總表」那顆箭頭——
          // 指回一個不是上一頁的地方只會讓人迷路，要回去按瀏覽器/系統的返回就好。
          actions={
            // 排序跟選取兩個模式互斥，開一個就把另一個關掉。
            <div className="flex shrink-0 items-center gap-2">
              <SortToggle
                sorting={sorting}
                onToggle={() => {
                  if (!sorting) selection.exit();
                  setSorting((v) => !v);
                }}
              />
              <SelectionToggle
                selecting={selection.selecting}
                onToggle={() => {
                  if (!selection.selecting) setSorting(false);
                  selection.toggleMode();
                }}
              />
            </div>
          }
        />
        {selection.selecting && (
          <SelectionBar
            count={selection.selectedIds.size}
            total={selection.total}
            onToggleAll={selection.toggleAll}
            onDelete={handleBulkDelete}
          />
        )}
      </StickyToolbar>

      <FloatingAddButton onClick={() => setBatchOpen(true)} label="新增帳戶類型" />

      <AccountTypeModal
        key={modal ? modal.id : "closed"}
        open={modal !== null}
        initial={modal ?? undefined}
        accountTypes={accountTypes}
        kind={modal?.kind ?? "asset"}
        excludeId={modal?.id}
        onClose={() => setModal(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
      <AccountTypeBatchModal open={batchOpen} onClose={() => setBatchOpen(false)} onSave={handleBatchSave} accountTypes={accountTypes} />

      {/* 批次刪除的確認。底下還有帳戶在用的類型刪不掉（API 會擋），所以這裡講的是
          「刪得掉的那些會進垃圾桶」，擋下來的理由由後面那個 blockedInfo 彈窗接手。 */}
      <ConfirmModal
        open={deleteConfirm !== null}
        title={(deleteConfirm?.length ?? 0) > 1 ? `刪除 ${deleteConfirm?.length} 個帳戶類型` : "刪除帳戶類型"}
        message={`底下還有帳戶在用的類型不會被刪除。${TRASH_RESTORE_NOTE}`}
        onConfirm={confirmBulkDelete}
        onClose={() => setDeleteConfirm(null)}
      />

      <ConfirmModal
        open={blockedInfo !== null}
        title="這個類型還有帳戶在用"
        // 兩種情況共用這個彈窗：刪不掉、以及資產/負債換不了。訊息由各自的呼叫端組好。
        message={blockedInfo?.message ?? ""}
        onlyAcknowledge
        onClose={() => setBlockedInfo(null)}
      />


      {accountTypes.length === 0 ? (
        <p className={text.faint}>還沒有任何帳戶類型，點右下角的＋新增</p>
      ) : (
        <div className="flex flex-col gap-5">
          {section("資產", assetTypes)}
          {section("負債", liabilityTypes)}
        </div>
      )}
    </div>
  );
}
