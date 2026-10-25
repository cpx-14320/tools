"use client";

import { useEffect, useState } from "react";
import { GroupedCardsSkeleton } from "@/components/expenses/skeleton";
import { useSkeletonShape, useSkeletonReady } from "@/components/expenses/skeleton-count";
import { PageHeader } from "@/components/expenses/page-header";
import { FloatingAddButton } from "@/components/expenses/floating-add-button";
import { SegmentedControl, Badge } from "@/components/expenses/button";
import { text } from "@/components/expenses/theme";
import { CategoryModal, type CategoryModalDraft } from "@/components/expenses/category-modal";
import { CategoryBatchModal, type CategoryBatchItem } from "@/components/expenses/category-batch-modal";
import { ConfirmModal } from "@/components/expenses/confirm-modal";
import { type AccountDTO } from "@/lib/expenses/accounts";
import { type AccountTypeDTO } from "@/lib/expenses/account-types";
import { SelectionBar, SelectionDot, SelectionToggle, useSelection } from "@/components/expenses/selection-bar";
import { SortArrows, SortToggle } from "@/components/expenses/sort-controls";
import { ListRow } from "@/components/expenses/list-row";
import { topLevelCategories, subCategoriesOf, categoryColorClass, type CategoryDTO, type CategoryKind } from "@/lib/expenses/categories";

/** 編輯既有分類／子分類用（點清單裡的一列開啟）；新增（不管頂層還是子分類）都走下面的
 *  batchTarget／CategoryBatchModal，兩種彈窗各自管各自的狀態。 */
type BatchTarget = { parentId?: string };

export function CategoriesView() {
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  // 編輯分類時可以指定「預設帳戶」，所以這一頁要知道有哪些帳戶；帳戶選擇彈窗還要靠
  // 帳戶類型分資產／負債兩組、取得類型圖示。
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const skeletonReady = useSkeletonReady();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<CategoryDTO | null>(null);
  const [batchTarget, setBatchTarget] = useState<BatchTarget | null>(null);
  const [kind, setKind] = useState<CategoryKind>("支出");
  const [deleteConfirm, setDeleteConfirm] = useState<{ ids: string[]; inUseCount: number; subCount: number } | null>(null);
  // 排序模式：每一列右邊長出 ↑↓。跟多選模式互斥——兩個都開的話一列右邊會擠進打勾、
  // 筆數跟兩顆箭頭，而且點一下到底是要選取還是要移動也說不清楚。
  const [sorting, setSorting] = useState(false);
  // 載入中畫骨架。這一頁是「一個主分類一張卡、底下掛它的子項目」，所以記的是形狀
  // （每張卡有幾個子項目）而不是單一列數；支出跟收入的分類數差很多，兩個分頁各記各的。
  const skeletonShape = useSkeletonShape(
    `cpx-tools:expenses-skeleton:categories:${kind}`,
    [3, 2, 0, 0],
    ready ? topLevelCategories(categories, kind).map((c) => subCategoriesOf(categories, c.id).length) : undefined,
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/expenses/categories").then((res) => res.json()),
      fetch("/api/expenses/transactions/counts").then((res) => res.json()),
      fetch("/api/expenses/accounts").then((res) => res.json()),
      fetch("/api/expenses/account-types").then((res) => res.json()),
    ])
      .then(([categoriesData, countsData, accountsData, accountTypesData]: [
        { categories?: CategoryDTO[] },
        { counts?: Record<string, number> },
        { accounts?: AccountDTO[] },
        { accountTypes?: AccountTypeDTO[] },
      ]) => {
        if (cancelled) return;
        setCategories(categoriesData.categories ?? []);
        setCounts(countsData.counts ?? {});
        setAccounts(accountsData.accounts ?? []);
        setAccountTypes(accountTypesData.accountTypes ?? []);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    setModal(null);
  }

  // 刪除分類（單筆或多選批次共用）：先不帶 force 試刪，查無使用中紀錄的會直接刪掉、
  // 立刻反映在畫面上；有紀錄在用的會被擋下，彙總成一個總筆數，讓呼叫端跳一次確認彈窗
  // 問要不要強制刪除（確認後這些紀錄會被歸類到「未分類」，不會變成孤兒資料）。
  async function tryDeleteCategories(ids: string[], force: boolean) {
    let latest = categories;
    const blocked: string[] = [];
    let totalInUse = 0;
    for (const id of ids) {
      const res = await fetch(`/api/expenses/categories?id=${id}${force ? "&force=1" : ""}`, { method: "DELETE" }).catch(() => null);
      if (!res) continue;
      const data: { categories?: CategoryDTO[]; inUseCount?: number } = await res.json().catch(() => ({}));
      if (res.status === 409) {
        blocked.push(id);
        totalInUse += data.inUseCount ?? 0;
      } else if (data.categories) {
        latest = data.categories;
      }
    }
    setCategories(latest);
    return { blocked, totalInUse };
  }

  /** 選取的這批裡，主分類底下總共掛著幾個子分類——刪主分類會連子分類一起刪掉
   *  （見 categories.server.ts 的 deleteCategory），刪之前要先講清楚。 */
  function subCount(ids: string[]): number {
    return categories.filter((c) => c.parentId && ids.includes(c.parentId)).length;
  }

  async function handleDelete() {
    if (!modal) return;
    const ids = [modal.id];
    // 有子分類就先問一次，就算完全沒有紀錄在用也一樣——「刪一個主分類結果底下五個
    // 子分類一起不見」不該是按下去之後才發現的事。
    if (subCount(ids) > 0) {
      setModal(null);
      setDeleteConfirm({ ids, inUseCount: 0, subCount: subCount(ids) });
      return;
    }
    const { blocked, totalInUse } = await tryDeleteCategories(ids, false);
    setModal(null);
    if (blocked.length > 0) setDeleteConfirm({ ids: blocked, inUseCount: totalInUse, subCount: subCount(blocked) });
  }

  async function handleBulkDelete() {
    const ids = [...selection.selectedIds];
    if (subCount(ids) > 0) {
      setDeleteConfirm({ ids, inUseCount: 0, subCount: subCount(ids) });
      return;
    }
    const { blocked, totalInUse } = await tryDeleteCategories(ids, false);
    if (blocked.length > 0) {
      setDeleteConfirm({ ids: blocked, inUseCount: totalInUse, subCount: subCount(blocked) });
    } else {
      selection.exit();
    }
  }

  async function handleForceDelete() {
    if (!deleteConfirm) return;
    await tryDeleteCategories(deleteConfirm.ids, true);
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
    setBatchTarget(null);
  }

  const parents = topLevelCategories(categories, kind);
  // 多選可以連子分類一起選——選取清單包含目前分頁看得到的主分類跟它們底下的子分類，
  // 「全選」才不會漏掉子分類，刪除時也能一次把挑好的子分類清掉。
  const selectableIds = parents
    .filter((c) => !c.isUncategorized)
    .flatMap((c) => [c.id, ...subCategoriesOf(categories, c.id).map((sub) => sub.id)]);
  const selection = useSelection(selectableIds);

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
   *  categories 這個陣列本身就是顯示順序（伺服器已經照 order 排好，而 topLevelCategories／
   *  subCategoriesOf 都只是 filter、不會改變順序），所以本地端要立刻反映，只要把這一層
   *  原本佔的那幾個位置，按新順序重新填回去就好——不用自己維護一份 order 數字。 */
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
    <div>
      <PageHeader title="收支分類" help="支出與收入的分類都在這裡；分類底下可以再開子分類，方便細看同一種消費裡哪種類型花最多" />

      {/* 新增搬到右下角的浮動按鈕（跟首頁新增交易、帳戶類型頁同一招），標題列空出來。 */}
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
      <ConfirmModal
        open={deleteConfirm !== null}
        title={(deleteConfirm?.subCount ?? 0) > 0 ? "會連子分類一起刪除" : "這些分類還有紀錄"}
        message={[
          (deleteConfirm?.subCount ?? 0) > 0 ? `底下的 ${deleteConfirm?.subCount} 個子分類也會一起刪除。` : "",
          (deleteConfirm?.inUseCount ?? 0) > 0
            ? `還有共 ${deleteConfirm?.inUseCount} 筆交易或固定收支規則在用，刪除後這些紀錄會自動歸類到「未分類」，不會被刪除也不會變成孤兒資料。`
            : "已經記過的交易如果有掛到這些分類，會自動歸類到「未分類」，不會被刪除。",
          "確定要刪除嗎？",
        ]
          .filter(Boolean)
          .join("")}
        onConfirm={handleForceDelete}
        onClose={() => setDeleteConfirm(null)}
      />

      <div className="mb-4 flex items-center justify-between gap-2">
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

      {sorting && (
        <p className={`mb-3 rounded-2xl bg-[#F9F7FE] px-4 py-2.5 text-xs ${text.muted}`}>
          用每一列右邊的 ↑↓ 調整順序。子項目只會在自己的主分類裡面移動；排好的順序會同步到
          新增消費紀錄的分類格子、預算設定等所有列出分類的地方。
        </p>
      )}

      {selection.selecting && (
        <SelectionBar
          count={selection.selectedIds.size}
          total={selection.total}
          onToggleAll={selection.toggleAll}
          onCancel={selection.exit}
          onDelete={handleBulkDelete}
        />
      )}

      {!skeletonReady ? null : !ready ? (
        // 多選／排序模式下每張卡最後那一列「＋ 新增子分類」不顯示，骨架也跟著不畫。
        <GroupedCardsSkeleton shape={skeletonShape} footer={!selection.selecting && !sorting} />
      ) : parents.length === 0 ? (
        <p className={text.faint}>還沒有任何{kind}分類，點右下角的＋建立第一個</p>
      ) : (
        <div className="flex flex-col gap-3">
          {parents.map((c, parentIndex) => {
            const subs = subCategoriesOf(categories, c.id);
            return (
              <div key={c.id} className="overflow-hidden rounded-2xl border border-[#ECE4FA] bg-white">
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
                    sorting ? (
                      <SortArrows
                        onUp={() => move(parents, parentIndex, -1)}
                        onDown={() => move(parents, parentIndex, 1)}
                        canUp={parentIndex > 0}
                        canDown={parentIndex < parents.length - 1}
                      />
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
