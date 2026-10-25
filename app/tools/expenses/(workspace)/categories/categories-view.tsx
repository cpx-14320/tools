"use client";

import { useEffect, useState } from "react";
import { ListCardSkeleton } from "@/components/expenses/skeleton";
import { useSkeletonCount, useSkeletonReady } from "@/components/expenses/skeleton-count";
import { PageHeader } from "@/components/expenses/page-header";
import { FloatingAddButton } from "@/components/expenses/floating-add-button";
import { ExpandToggle } from "@/components/expenses/expand-toggle";
import { SegmentedControl, Badge } from "@/components/expenses/button";
import { text } from "@/components/expenses/theme";
import { CategoryModal, type CategoryModalDraft } from "@/components/expenses/category-modal";
import { CategoryBatchModal, type CategoryBatchItem } from "@/components/expenses/category-batch-modal";
import { ConfirmModal } from "@/components/expenses/confirm-modal";
import { type AccountDTO } from "@/lib/expenses/accounts";
import { type AccountTypeDTO } from "@/lib/expenses/account-types";
import { SelectionBar, SelectionDot, SelectionToggle, useSelection } from "@/components/expenses/selection-bar";
import { ListRow } from "@/components/expenses/list-row";
import { topLevelCategories, subCategoriesOf, categoryColorClass, type CategoryDTO, type CategoryKind } from "@/lib/expenses/categories";

/** 編輯既有分類／子分類用（點清單裡的一列開啟）；新增（不管頂層還是子分類）都走下面的
 *  batchTarget／CategoryBatchModal，兩種彈窗各自管各自的狀態。 */
type BatchTarget = { parentId?: string };

/** 一個主分類底下預設只攤開三則子項目，再多就收起來、用首頁那顆「顯示全部 (n)／收合」
 *  （ExpandToggle）展開。子項目可能很多（薪水底下光是各種獎金禮金就快十則），全部攤開
 *  的話光是一個分類就佔滿整個畫面，下面還有幾個主分類完全看不到。三則足夠看出「這個
 *  分類底下大概是哪一類的東西」，要編輯特定一則再展開。 */
const SUB_PREVIEW_COUNT = 3;

export function CategoriesView() {
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  // 編輯分類時可以指定「預設帳戶」，所以這一頁要知道有哪些帳戶；帳戶選擇彈窗還要靠
  // 帳戶類型分資產／負債兩組、取得類型圖示。
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const skeletonReady = useSkeletonReady();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  // 載入中畫骨架，列數用上次記住的實際筆數（見 skeleton-count.ts）。
  const skeletonCount = useSkeletonCount("cpx-tools:expenses-skeleton:categories", 6, ready ? categories.filter((c) => !c.parentId).length : undefined);
  const [modal, setModal] = useState<CategoryDTO | null>(null);
  const [batchTarget, setBatchTarget] = useState<BatchTarget | null>(null);
  const [kind, setKind] = useState<CategoryKind>("支出");
  const [deleteConfirm, setDeleteConfirm] = useState<{ ids: string[]; inUseCount: number; subCount: number } | null>(null);
  // 哪幾個主分類的子項目被展開了（見 SUB_PREVIEW_COUNT）。存 id 陣列而不是 Set：
  // 要產生新的值才會觸發重繪，Set 就地 add/delete 是同一個物件、畫面不會更新。
  const [expandedParents, setExpandedParents] = useState<string[]>([]);

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

  // 多選模式一律全部攤開——收起來的子項目也會被「全選」勾到，看不到就刪掉太危險。
  const subsExpanded = (parentId: string) => selection.selecting || expandedParents.includes(parentId);
  const toggleSubs = (parentId: string) =>
    setExpandedParents((list) => (list.includes(parentId) ? list.filter((id) => id !== parentId) : [...list, parentId]));

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
        <SelectionToggle selecting={selection.selecting} onToggle={selection.toggleMode} />
      </div>

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
        <ListCardSkeleton count={skeletonCount} />
      ) : parents.length === 0 ? (
        <p className={text.faint}>還沒有任何{kind}分類，點右下角的＋建立第一個</p>
      ) : (
        <div className="flex flex-col gap-3">
          {parents.map((c) => {
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
                  right={<span className={text.muted}>{totalCount(c.id)} 筆紀錄</span>}
                  leading={selection.selecting && !c.isUncategorized ? <SelectionDot selected={selection.selectedIds.has(c.id)} /> : undefined}
                  onClick={() => (selection.selecting ? (c.isUncategorized ? undefined : selection.toggle(c.id)) : setModal(c))}
                />

                {subs.length > 0 && (
                  <div className="border-t border-[#ECE4FA] bg-[#F9F7FE]">
                    <div className="flex flex-col divide-y divide-[#F2EEFA]">
                      {(subsExpanded(c.id) ? subs : subs.slice(0, SUB_PREVIEW_COUNT)).map((sub) => (
                        <ListRow
                          key={sub.id}
                          name={sub.name}
                          right={<span className={text.muted}>{counts[sub.id] ?? 0} 筆</span>}
                          leading={selection.selecting ? <SelectionDot selected={selection.selectedIds.has(sub.id)} /> : undefined}
                          onClick={() => (selection.selecting ? selection.toggle(sub.id) : setModal(sub))}
                        />
                      ))}
                    </div>
                    {/* 多選模式下不收合（上面的 subsExpanded 已經一律回 true）：收起來的那幾則
                        還是會被「全選」勾到，按下刪除時使用者看不到自己正要刪掉什麼。 */}
                    {subs.length > SUB_PREVIEW_COUNT && !selection.selecting && (
                      <div className="pb-2">
                        <ExpandToggle expanded={subsExpanded(c.id)} total={subs.length} onToggle={() => toggleSubs(c.id)} />
                      </div>
                    )}
                  </div>
                )}

                {!selection.selecting && (
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
