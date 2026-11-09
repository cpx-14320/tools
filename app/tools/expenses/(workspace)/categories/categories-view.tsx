"use client";

import { useState } from "react";
import { TOAST, useToast } from "@/components/expenses/toast";
import { useUndoDelete } from "@/components/expenses/use-undo-delete";
import { PageHeader } from "@/components/expenses/page-header";
import { FloatingAddButton } from "@/components/expenses/floating-add-button";
import { SegmentedControl, Badge } from "@/components/expenses/button";
import { text } from "@/components/expenses/theme";
import { CategoryModal, type CategoryModalDraft } from "@/components/expenses/category-modal";
import { CategoryBatchModal, type CategoryBatchItem } from "@/components/expenses/category-batch-modal";
import { AccountPickerModal } from "@/components/expenses/account-picker-modal";
import { LineIconButton } from "@/components/expenses/line-icon-button";
import { Modal, ModalFooter } from "@/components/expenses/modal";
import { ConfirmModal } from "@/components/expenses/confirm-modal";
import { BusyOverlay } from "@/components/expenses/busy-overlay";
import { TRASH_RESTORE_NOTE } from "@/lib/expenses/trash";
import { type AccountDTO } from "@/lib/expenses/accounts";
import { type AccountTypeDTO } from "@/lib/expenses/account-types";
import { SelectionBar, SelectionDot, SelectionToggle, useSelection } from "@/components/expenses/selection-bar";
import { SortArrows, SortToggle } from "@/components/expenses/sort-controls";
import { ListRow } from "@/components/expenses/list-row";
import { topLevelCategories, subCategoriesOf, categoryColorClass, type CategoryDTO, type CategoryKind } from "@/lib/expenses/categories";

/** 編輯既有分類／子分類用（點清單裡的一列開啟）；新增（不管頂層還是子分類）都走下面的
 *  batchTarget／CategoryBatchModal，兩種彈窗各自管各自的狀態。 */
type BatchTarget = { parentId?: string };

/** 收支分類頁。資料都是 page.tsx 在伺服器上讀好傳進來的，所以沒有「載入中」這個狀態，
 *  也不需要骨架：第一次畫出來就是有資料的畫面。 */
export function CategoriesView({
  initialCategories,
  /** 每個分類有幾筆交易。只拿來顯示「N 筆」跟刪除前的提示，這一頁不會改交易，所以
   *  不用放進 state。 */
  counts,
  /** 編輯分類時可以指定「預設帳戶」，所以這一頁要知道有哪些帳戶；帳戶選擇彈窗還要靠
   *  帳戶類型分資產／負債兩組、取得類型圖示。兩份都是別的頁面在改的，這一頁只讀。 */
  accounts,
  accountTypes,
}: {
  initialCategories: CategoryDTO[];
  counts: Record<string, number>;
  accounts: AccountDTO[];
  accountTypes: AccountTypeDTO[];
}) {
  const [categories, setCategories] = useState<CategoryDTO[]>(initialCategories);
  const showToast = useToast();
  const showDeleteToast = useUndoDelete();
  const [modal, setModal] = useState<CategoryDTO | null>(null);
  const [batchTarget, setBatchTarget] = useState<BatchTarget | null>(null);
  const [kind, setKind] = useState<CategoryKind>("支出");
  const [deleteConfirm, setDeleteConfirm] = useState<{ ids: string[]; inUseCount: number; subCount: number } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  // 排序模式：每一列右邊長出 ↑↓。跟多選模式互斥——兩個都開的話一列右邊會擠進打勾、
  // 筆數跟兩顆箭頭，而且點一下到底是要選取還是要移動也說不清楚。
  const [sorting, setSorting] = useState(false);

  async function handleSave(
    draft: Pick<CategoryModalDraft, "name"> &
      Partial<Pick<CategoryModalDraft, "icon" | "color" | "kind" | "defaultAccountId">> & { budgetAmount?: number | null },
  ) {
    if (!modal) return;
    const data: { categories?: CategoryDTO[] } = await fetch("/api/expenses/categories", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: modal.id, ...draft }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.categories) setCategories(data.categories);
    showToast(TOAST.saved);
    setModal(null);
  }

  /** 真的刪（單筆或多選批次共用）。一律帶 force——確認彈窗已經把「有幾筆交易會被改掛到
   *  未分類」講過了，進到這裡就是使用者已經同意的意思，再被 409 擋一次只會變成要按兩次。
   *
   *  還是保留 force 參數跟 409 的處理：API 的約定是「沒帶 force 又有紀錄在用就擋」，
   *  擋下來的那幾筆不能算進「已刪除 N 筆」的提示裡。 */
  async function tryDeleteCategories(ids: string[], force: boolean) {
    let latest = categories;
    const blocked: string[] = [];
    const trashIds: (string | undefined)[] = [];
    let totalInUse = 0;
    for (const id of ids) {
      const res = await fetch(`/api/expenses/categories?id=${id}${force ? "&force=1" : ""}`, { method: "DELETE" }).catch(() => null);
      if (!res) continue;
      const data: { categories?: CategoryDTO[]; inUseCount?: number; trashId?: string } = await res.json().catch(() => ({}));
      if (res.status === 409) {
        blocked.push(id);
        totalInUse += data.inUseCount ?? 0;
      } else if (data.categories) {
        latest = data.categories;
        trashIds.push(data.trashId);
      }
    }
    setCategories(latest);
    // 被 409 擋下的那幾筆不算刪掉了，所以用「送出的筆數 － 被擋下的」當真正刪掉的數量；
    // 一筆都沒刪成功時不報，不然使用者會以為刪掉了。
    const deleted = ids.length - blocked.length;
    if (deleted > 0) {
      // 復原會把分類、子分類、預算規則，以及「被改掛到未分類的那幾筆交易」一起拿回來
      // （見 categories.server.ts 的 reassigned）。
      showDeleteToast(
        trashIds,
        async () => {
          const fresh: { categories?: CategoryDTO[] } = await fetch("/api/expenses/categories").then((r) => r.json());
          if (fresh.categories) setCategories(fresh.categories);
        },
        deleted === 1 ? TOAST.deleted : `已刪除 ${deleted} 筆`,
      );
    }
    return { blocked, totalInUse };
  }

  /** 選取的這批裡，主分類底下總共掛著幾個子分類——刪主分類會連子分類一起刪掉
   *  （見 categories.server.ts 的 deleteCategory），刪之前要先講清楚。 */
  function subCount(ids: string[]): number {
    return categories.filter((c) => c.parentId && ids.includes(c.parentId)).length;
  }

  /** 這批分類（含底下的子分類）身上總共掛了幾筆交易。
   *
   *  用的是 page.tsx 傳進來的 counts，所以確認彈窗不必先打一次 API 去問——以前是「先
   *  試刪、被擋下來才知道有幾筆」，所以沒被擋的那種（乾淨的分類）根本不會跳確認。 */
  function inUseCount(ids: string[]): number {
    const all = new Set(ids);
    for (const c of categories) if (c.parentId && ids.includes(c.parentId)) all.add(c.id);
    return [...all].reduce((sum, id) => sum + (counts[id] ?? 0), 0);
  }

  /** 刪除分類一律先問。
   *
   *  **為什麼不分情況**：本來是「有子分類或有紀錄在用才問，乾淨的直接刪」，結果變成
   *  「刪得掉的不問、刪不掉的才問」，剛好跟直覺相反——使用者在列表上勾了幾個分類按刪除，
   *  什麼都沒跳就少了幾列。刪分類的副作用（連帶子分類、交易被改掛到未分類）正是最需要
   *  先講一聲的那種，所以不管乾不乾淨都走同一道確認，差別只在彈窗裡多講幾句。 */
  function askDelete(ids: string[]) {
    if (ids.length === 0) return;
    setDeleteConfirm({ ids, inUseCount: inUseCount(ids), subCount: subCount(ids) });
  }

  function handleDelete() {
    if (!modal) return;
    const ids = [modal.id];
    setModal(null);
    askDelete(ids);
  }

  function handleBulkDelete() {
    askDelete([...selection.selectedIds]);
  }

  async function handleForceDelete() {
    if (!deleteConfirm) return;
    setDeleteBusy(true);
    await tryDeleteCategories(deleteConfirm.ids, true);
    setDeleteBusy(false);
    setDeleteConfirm(null);
    selection.exit();
  }

  // 批次新增：逐筆依序 POST（不是 Promise.all 併發），理由跟薪資明細類型批次新增一樣——
  // createCategory 的 order 是用當下已存在筆數算出來的，併發送出會拿到同一個 order。
  async function handleBatchSave(items: CategoryBatchItem[]) {
    if (!batchTarget) return;
    let latest = categories;
    for (const item of items) {
      const data: { categories?: CategoryDTO[]; error?: string } = await fetch("/api/expenses/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item, parentId: batchTarget.parentId }),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (data.categories) {
        latest = data.categories;
      } else if (data.error) {
        alert(data.error);
        break;
      }
    }
    setCategories(latest);
    showToast(items.length === 1 ? TOAST.created : `已新增 ${items.length} 筆`);
    setBatchTarget(null);
  }

  // 依預設帳戶篩選（跟明細頁那顆篩選同一個位置、同一顆圖示）。
  //  accountFilter  ＝ 只看預設帳戶是這一個的分類（空字串＝不篩）
  //  unassignedOnly ＝ 只看還沒設預設帳戶的分類
  // 兩個互斥：選了某個帳戶就不可能同時「沒設帳戶」。
  const [filterOpen, setFilterOpen] = useState(false);
  const [accountFilter, setAccountFilter] = useState("");
  const [unassignedOnly, setUnassignedOnly] = useState(false);

  // 批次改預設帳戶分三步：勾選分類 → 挑帳戶（accountPicker）→ 工具列顯示「修改帳戶 →
  // 玉山銀行」，按「完成」才送出。pendingAccount 存的就是「挑好但還沒套用」的那個帳戶。
  //
  // **為什麼不挑完就送**：挑帳戶的彈窗一關，手指還在原地，幾十個分類的預設帳戶就已經
  // 被改掉了，而且使用者沒有任何機會複查自己剛剛點到哪一個。
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [pendingAccount, setPendingAccount] = useState<{ accountId: string | undefined } | null>(null);
  const [accountBusy, setAccountBusy] = useState(false);

  // 篩的是主分類——預設帳戶只設在主分類上，子分類跟著它的主分類一起出現或消失。
  const allParents = topLevelCategories(categories, kind);
  const parents = allParents.filter((c) => {
    if (unassignedOnly) return !c.defaultAccountId;
    if (accountFilter) return c.defaultAccountId === accountFilter;
    return true;
  });
  const filterCount = (accountFilter ? 1 : 0) + (unassignedOnly ? 1 : 0);
  // 排序時「未分類」不參與：它固定在最後一個（見 topLevelCategories），給它上下箭頭
  // 等於給一個按了會被打回原位的按鈕。它前面那一個的「往下」也要跟著收掉。
  const sortable = parents.filter((c) => !c.isUncategorized);

  // 多選可以連子分類一起選——選取清單包含目前畫面上的主分類跟它們底下的子分類，
  // 「全選」才不會漏掉子分類，刪除時也能一次把挑好的子分類清掉。
  //
  // 「修改帳戶」只動得到主分類（預設帳戶照設計只設在主分類上，見 categories.ts 的
  // defaultAccountForCategory），勾到的子分類會被略過——那個動作自己會講清楚。
  const selectableIds = parents
    .filter((c) => !c.isUncategorized)
    .flatMap((c) => [c.id, ...subCategoriesOf(categories, c.id).map((sub) => sub.id)]);
  const selection = useSelection(selectableIds);

  /** 勾起來的項目裡，真正會被「改帳戶」動到的那幾個。
   *
   *  **只有主分類**：預設帳戶照設計只設在主分類上，子分類是沿用主分類的（見 categories.ts
   *  的 defaultAccountForCategory）。把它寫進子分類不但沒有作用，之後還會變成一堆對不起來
   *  的殘留資料，所以勾到子分類就當作沒勾到。 */
  function selectedTopLevel(): CategoryDTO[] {
    return parents.filter((c) => selection.selectedIds.has(c.id));
  }

  function accountName(accountId: string | undefined): string {
    return accounts.find((a) => a.id === accountId)?.name ?? "（已刪除帳戶）";
  }

  /** 真的送出批次改帳戶。整批 id 一次 PATCH 給後端跑——本來是前端迴圈一筆一個請求，
   *  勾二三十個分類就是二三十個來回，而且每個回應都帶一份完整 categories，前端還得自己
   *  決定哪一份才是最新的。 */
  async function applyDefaultAccount() {
    const accountId = pendingAccount?.accountId;
    const targets = selectedTopLevel();
    if (targets.length === 0) return;
    setAccountBusy(true);
    const data: { updated?: number; categories?: CategoryDTO[]; error?: string } = await fetch("/api/expenses/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: targets.map((c) => c.id), defaultAccountId: accountId ?? null }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    setAccountBusy(false);
    // 失敗要講出來。本來不管結果都報「改好了」，所以這個功能壞掉（打到不存在的 PATCH、
    // 回 405）整整一版都沒人發現——畫面上看起來成功，重新整理才知道沒變。
    if (!data.categories) {
      showToast(data.error ?? "改不動，再試一次");
      return;
    }
    setCategories(data.categories);
    // 勾到的子分類不會被改到（預設帳戶只設在主分類上），所以直接把「改了幾個」講出來，
    // 不要讓使用者拿「已選 8 項」去對「改好了」然後以為有幾個漏掉。
    const skipped = selection.selectedIds.size - targets.length;
    const what = accountId ? `改成「${accountName(accountId)}」` : "改成不指定帳戶";
    const n = data.updated ?? targets.length;
    showToast(skipped > 0 ? `${n} 個主分類${what}（子分類沿用主分類，不另外設）` : `${n} 個分類${what}`);
    setPendingAccount(null);
    selection.exit();
  }

  /** 挑完帳戶只記下來，不送出：工具列會換成待確認狀態，等「完成」。 */
  function handleAccountPicked(accountId: string | undefined) {
    setAccountPickerOpen(false);
    setPendingAccount({ accountId });
  }

  // 待確認時工具列要補的那行細節：有幾個原本已經設過帳戶、會被蓋掉。使用者這一刻要判斷
  // 的是「我是不是不小心勾到了」，光一個數字判斷不了，所以把名稱也列出來（多了就收尾）。
  const overwriteTargets = pendingAccount
    ? selectedTopLevel().filter((c) => c.defaultAccountId && c.defaultAccountId !== pendingAccount.accountId)
    : [];
  const pendingDetail = (() => {
    if (!pendingAccount) return "";
    const parts: string[] = [];
    const subs = selection.selectedIds.size - selectedTopLevel().length;
    if (overwriteTargets.length > 0) {
      const names = overwriteTargets.slice(0, 3).map((c) => `${c.name}（${accountName(c.defaultAccountId)}）`).join("、");
      parts.push(`${overwriteTargets.length} 個原本已設定會被蓋掉：${names}${overwriteTargets.length > 3 ? "…" : ""}`);
    }
    if (subs > 0) parts.push(`勾到的 ${subs} 個子分類沿用主分類，不會改`);
    return parts.join("・");
  })();

  /** 一個主分類右邊要顯示的筆數＝它自己的 ＋ 底下所有子項目的。
   *
   *  有子項目的主分類一定要選到子項目才能記帳（見 categories.ts 的 needsSubcategory），
   *  所以它自己的筆數永遠是 0——直接顯示那個 0 會讓人以為「餐飲完全沒在花錢」，其實
   *  錢都記在早餐／午餐／晚餐上。沒有子項目的主分類則本來就是終點，加總起來就是它
   *  自己的筆數，同一條算式兩種情況都對。
   *
   *  還是把自己的加進去：改版前（還沒拆子分類時）記在主分類身上的舊紀錄、以及強制
   *  刪除子分類後被改掛回主分類的紀錄，都會掛在主分類自己身上，漏掉就對不上總數。 */
  function totalCount(parentId: string): number {
    return (counts[parentId] ?? 0) + subCategoriesOf(categories, parentId).reduce((sum, sub) => sum + (counts[sub.id] ?? 0), 0);
  }

  /** 把 group 這一層重排成 nextIds 的順序，回傳整份 categories 的新陣列。
   *
   *  categories 這個陣列的順序就是伺服器上的 order，所以本地端要立刻反映，只要把這一層
   *  原本佔的那幾個位置，按新順序重新填回去就好——不用自己維護一份 order 數字。
   *
   *  topLevelCategories 會把「未分類」挪到最後，但它不參與排序（sortable 已經把它濾掉），
   *  其餘項目的相對順序跟這個陣列一致，所以位置對得起來。 */
  function reorderLocal(group: CategoryDTO[], nextIds: string[]): CategoryDTO[] {
    const positions = group.map((g) => categories.findIndex((c) => c.id === g.id)).sort((a, b) => a - b);
    const byId = new Map(categories.map((c) => [c.id, c]));
    const next = [...categories];
    nextIds.forEach((id, i) => {
      const cat = byId.get(id);
      if (cat) next[positions[i]] = cat;
    });
    return next;
  }

  /** 把 group 裡第 index 筆往上／往下移一格。
   *
   *  先改本地畫面再送出（樂觀更新）：點一下就要看到它動，等伺服器來回的話連點幾下會
   *  一卡一卡的。送出的是整層排好的 id 順序，不是「跟上一個交換」（見
   *  categories.server.ts 的 reorderCategories）。 */
  async function move(group: CategoryDTO[], index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= group.length) return;
    const nextGroup = [...group];
    [nextGroup[index], nextGroup[target]] = [nextGroup[target], nextGroup[index]];
    const nextIds = nextGroup.map((c) => c.id);
    setCategories(reorderLocal(group, nextIds));

    const data: { categories?: CategoryDTO[] } = await fetch("/api/expenses/categories/order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: nextIds }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    // 用伺服器回來的那份覆蓋，順便把 order 正規化的結果同步回畫面；失敗就留著樂觀更新
    // 的結果，重新整理後會回到伺服器上真正的順序。
    if (data.categories) setCategories(data.categories);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 篩選圖示擺在標題右邊，跟明細頁同一顆、同一個位置——兩頁問的是同一件事
          （這份清單現在只看什麼），擺在不同地方會讓人每頁重找一次。
          有設條件時圖示轉紫，一眼看得出清單是被篩過的。 */}
      <PageHeader
        flush
        title="收支分類"
        help="分類底下可以再開子分類，報表會分開統計；設了預設帳戶的分類，記帳時會自動帶出那個帳戶"
        actions={
          <LineIconButton
            icon="filter"
            active={filterCount > 0}
            onClick={() => setFilterOpen(true)}
            aria-label={filterCount > 0 ? `篩選（${filterCount} 個條件）` : "篩選"}
            title="篩選"
          />
        }
      />

      {/* 新增搬到右下角的浮動按鈕（跟首頁新增交易、帳戶類型頁同一招），標題列空出來。 */}
      {/* 等資料回來才出現：它是 fixed、不佔版面，所以不需要骨架，但資料還沒回來就先浮在
          一片灰條上面很突兀（跟首頁、資產總表同一個處理）。 */}
      <FloatingAddButton onClick={() => setBatchTarget({})} label="新增分類" />

      <CategoryModal
        key={modal ? modal.id : "edit-closed"}
        open={modal !== null}
        isSubcategory={!!modal?.parentId}
        parentId={modal?.parentId}
        categories={categories}
        accounts={accounts}
        accountTypes={accountTypes}
        excludeId={modal?.id}
        initial={modal ?? undefined}
        onClose={() => setModal(null)}
        onSave={handleSave}
        // 「未分類」不給刪（見 categories.server.ts 的守門），所以連刪除鈕都不顯示。
        onDelete={modal?.isUncategorized ? undefined : handleDelete}
      />

      <CategoryBatchModal
        key={batchTarget ? (batchTarget.parentId ?? "top") : "batch-closed"}
        open={batchTarget !== null}
        isSubcategory={!!batchTarget?.parentId}
        parentId={batchTarget?.parentId}
        categories={categories}
        lockedKind={kind}
        onClose={() => setBatchTarget(null)}
        onSave={handleBatchSave}
      />

      {/* 兩件事分開講：子分類會跟著一起消失、既有紀錄會被改掛到「未分類」。
          兩種情況可能同時發生，所以訊息是組出來的，不是二選一。 */}
      {/* 篩選：帳戶清單 ＋「只看未指定」。點了不立刻關窗——跟明細頁的篩選一樣，
          要讓使用者設完再按套用。 */}
      <Modal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="篩選"
        footer={
          // 不放「清除條件」：這裡只有兩個互斥的開關，再點一次那顆亮著的就關掉了，
          // 多一顆清除鍵等於同一件事提供兩個入口。（明細頁有分類多選＋金額區間，一個一個
          // 關很煩，那裡才需要。）
          <ModalFooter onClose={() => setFilterOpen(false)} onConfirm={() => setFilterOpen(false)} />
        }
      >
        <div>
          {/* 沒設預設帳戶的分類，記帳時不會自動帶帳戶。沒有這個開關的話，要找出「哪幾個
              還沒設」只能一個一個點開看。 */}
          <p className={`mb-2 ${text.label}`}>預設帳戶</p>
          <button
            type="button"
            onClick={() => {
              setUnassignedOnly((v) => !v);
              // 兩個條件互斥：選了「只看未指定」就不該同時卡著某個帳戶。
              setAccountFilter("");
            }}
            className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
              unassignedOnly ? "border-[#6F5FD6] bg-[#F3EFFC] font-medium text-[#6F5FD6]" : "border-[#ECE4FA] bg-white text-[#4A3B7C]"
            }`}
          >
            只看未指定帳戶的分類
          </button>
        </div>

        <div>
          <p className={`mb-2 ${text.label}`}>指定帳戶</p>
          <div className="flex flex-wrap gap-2">
            {accounts.map((a) => {
              const active = accountFilter === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setAccountFilter(active ? "" : a.id);
                    setUnassignedOnly(false);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    active ? "border-[#6F5FD6] bg-[#F3EFFC] font-medium text-[#6F5FD6]" : "border-[#ECE4FA] bg-white text-[#4A3B7C]"
                  }`}
                >
                  {a.name}
                </button>
              );
            })}
            {accounts.length === 0 && <p className={text.faint}>還沒有任何帳戶</p>}
          </div>
        </div>
      </Modal>

      {/* 挑預設帳戶：不顯示餘額、「不指定」改成「不設預設帳戶」——這裡問的是「這類支出
          習慣從哪個戶頭出」，跟當下餘額無關（跟分類編輯彈窗裡那個挑法一致）。 */}
      <AccountPickerModal
        open={accountPickerOpen}
        title="修改帳戶"
        accounts={accounts}
        accountTypes={accountTypes}
        showBalance={false}
        unsetLabel="不設預設帳戶"
        onClose={() => setAccountPickerOpen(false)}
        onSelect={handleAccountPicked}
      />

      {/* 批次改帳戶送出期間蓋住畫面：勾了幾十個分類時後端要跑一會兒，沒有這塊的話
          使用者會以為「完成」沒反應，再按一次。 */}
      <BusyOverlay open={accountBusy} label="修改中…" />
      <BusyOverlay open={deleteBusy} label="刪除中…" />

      <ConfirmModal
        open={deleteConfirm !== null}
        // 標題講「刪什麼、幾個」；會連帶刪掉子分類是最需要先看到的那件事，所以它優先。
        title={
          (deleteConfirm?.subCount ?? 0) > 0
            ? "會連子分類一起刪除"
            : (deleteConfirm?.ids.length ?? 0) > 1
              ? `刪除 ${deleteConfirm?.ids.length} 個分類`
              : "刪除分類"
        }
        message={[
          (deleteConfirm?.subCount ?? 0) > 0 ? `底下的 ${deleteConfirm?.subCount} 個子分類也會一起刪除。` : "",
          (deleteConfirm?.inUseCount ?? 0) > 0
            ? `共 ${deleteConfirm?.inUseCount} 筆交易掛在上面，刪除後會自動歸類到「未分類」，紀錄本身不會被刪掉。`
            : "已經記過的交易如果有掛到這些分類，會自動歸類到「未分類」，不會被刪除。",
          TRASH_RESTORE_NOTE,
        ]
          .filter(Boolean)
          .join("")}
        confirmLabel={deleteBusy ? "刪除中…" : "刪除"}
        onConfirm={handleForceDelete}
        onClose={() => setDeleteConfirm(null)}
      />

      <div className="flex items-center justify-between gap-2">
        <SegmentedControl
          value={kind}
          onChange={setKind}
          options={[
            { value: "支出", label: "支出" },
            { value: "收入", label: "收入" },
          ]}
        />
        {/* 排序跟選取兩個模式互斥，開一個就把另一個關掉。 */}
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
      </div>

      {selection.selecting && (
        <SelectionBar
          count={selection.selectedIds.size}
          total={selection.total}
          actions={[
            {
              label: "修改帳戶",
              onClick: () => {
                // 只勾到子分類時擋在這裡講原因，而不是讓他挑完帳戶才發現什麼都沒變。
                if (selectedTopLevel().length === 0) {
                  showToast("預設帳戶設在主分類上，請勾選主分類");
                  return;
                }
                setAccountPickerOpen(true);
              },
            },
          ]}
          pending={
            pendingAccount
              ? {
                  summary: `修改帳戶 → ${pendingAccount.accountId ? accountName(pendingAccount.accountId) : "不設預設帳戶"}`,
                  detail: pendingDetail,
                  confirmLabel: `完成（${selectedTopLevel().length} 個）`,
                  busy: accountBusy,
                  onConfirm: () => void applyDefaultAccount(),
                  onCancel: () => setPendingAccount(null),
                }
              : undefined
          }
          onToggleAll={selection.toggleAll}
          onCancel={selection.exit}
          onDelete={handleBulkDelete}
        />
      )}

      {parents.length === 0 ? (
        // 篩掉之後變空的，要講清楚是「被篩掉」不是「沒有分類」——不然使用者會以為
        // 自己的分類不見了（明細頁踩過同一個坑）。
        <p className={text.faint}>
          {filterCount > 0 ? "沒有符合篩選條件的分類。" : `還沒有任何${kind}分類，點右下角的＋建立第一個`}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {parents.map((c) => {
            const subs = subCategoriesOf(categories, c.id);
            const sortableIndex = sortable.indexOf(c);
            return (
              // 排序模式下「未分類」整張淡掉：它固定在最後一個、不能移動，淡化是讓人
              // 一眼看出「這張不用管」，而不是讓他去找為什麼那一列沒有箭頭。
              <div
                key={c.id}
                className={`overflow-hidden rounded-2xl border border-[#ECE4FA] bg-white ${sorting && c.isUncategorized ? "opacity-50" : ""}`}
              >
                <ListRow
                  icon={c.icon}
                  iconClassName={categoryColorClass[c.color]}
                  name={
                    c.isUncategorized ? (
                      <span className="flex items-center gap-1.5">
                        {c.name}
                        <Badge>系統</Badge>
                      </span>
                    ) : (
                      c.name
                    )
                  }
                  // 排序模式下右邊換成 ↑↓：筆數跟箭頭擠在一起會太滿，而且排序時在意的
                  // 是順序不是筆數。主分類只在同一個收支分頁裡面移動（parents 已經篩過 kind）。
                  right={
                    // 排序模式：能動的顯示 ↑↓，未分類什麼都不顯示——那個「0 筆紀錄」在
                    // 這個模式下既不能按也不是重點，留著只是噪音。
                    sorting ? (
                      c.isUncategorized ? undefined : (
                        <SortArrows
                          onUp={() => move(sortable, sortableIndex, -1)}
                          onDown={() => move(sortable, sortableIndex, 1)}
                          canUp={sortableIndex > 0}
                          canDown={sortableIndex < sortable.length - 1}
                        />
                      )
                    ) : (
                      <span className={text.muted}>{totalCount(c.id)} 筆紀錄</span>
                    )
                  }
                  leading={selection.selecting && !c.isUncategorized ? <SelectionDot selected={selection.selectedIds.has(c.id)} /> : undefined}
                  onClick={
                    sorting ? undefined : () => (selection.selecting ? (c.isUncategorized ? undefined : selection.toggle(c.id)) : setModal(c))
                  }
                />

                {subs.length > 0 && (
                  <div className="flex flex-col divide-y divide-[#F2EEFA] border-t border-[#ECE4FA] bg-[#F9F7FE]">
                    {subs.map((sub, subIndex) => (
                      <ListRow
                        key={sub.id}
                        name={sub.name}
                        // 子項目的 ↑↓ 只在 subs（同一個主分類底下）裡面移動，不會跨到別的分類。
                        right={
                          sorting ? (
                            <SortArrows
                              onUp={() => move(subs, subIndex, -1)}
                              onDown={() => move(subs, subIndex, 1)}
                              canUp={subIndex > 0}
                              canDown={subIndex < subs.length - 1}
                            />
                          ) : (
                            <span className={text.muted}>{counts[sub.id] ?? 0} 筆</span>
                          )
                        }
                        leading={selection.selecting ? <SelectionDot selected={selection.selectedIds.has(sub.id)} /> : undefined}
                        onClick={sorting ? undefined : () => (selection.selecting ? selection.toggle(sub.id) : setModal(sub))}
                      />
                    ))}
                  </div>
                )}

                {!selection.selecting && !sorting && (
                  <div className="border-t border-[#ECE4FA] px-4 py-2">
                    <button
                      type="button"
                      onClick={() => setBatchTarget({ parentId: c.id })}
                      className="text-xs font-medium text-[#6F5FD6] hover:underline"
                    >
                      ＋ 新增子分類
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
