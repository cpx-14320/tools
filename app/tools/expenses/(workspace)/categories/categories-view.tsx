"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/expenses/page-header";
import { FloatingAddButton } from "@/components/expenses/floating-add-button";
import { SegmentedControl, Badge } from "@/components/expenses/button";
import { text } from "@/components/expenses/theme";
import { CategoryModal, type CategoryModalDraft } from "@/components/expenses/category-modal";
import { CategoryBatchModal, type CategoryBatchItem } from "@/components/expenses/category-batch-modal";
import { ConfirmModal } from "@/components/expenses/confirm-modal";
import { SelectionBar, SelectionDot, SelectionToggle, useSelection } from "@/components/expenses/selection-bar";
import { ListRow } from "@/components/expenses/list-row";
import { topLevelCategories, subCategoriesOf, categoryColorClass, type CategoryDTO, type CategoryKind } from "@/lib/expenses/categories";

/** 編輯既有分類／子分類用（點清單裡的一列開啟）；新增（不管頂層還是子分類）都走下面的
 *  batchTarget／CategoryBatchModal，兩種彈窗各自管各自的狀態。 */
type BatchTarget = { parentId?: string };

export function CategoriesView() {
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<CategoryDTO | null>(null);
  const [batchTarget, setBatchTarget] = useState<BatchTarget | null>(null);
  const [kind, setKind] = useState<CategoryKind>("支出");
  const [deleteConfirm, setDeleteConfirm] = useState<{ ids: string[]; inUseCount: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/expenses/categories").then((res) => res.json()),
      fetch("/api/expenses/transactions/counts").then((res) => res.json()),
    ])
      .then(([categoriesData, countsData]: [{ categories?: CategoryDTO[] }, { counts?: Record<string, number> }]) => {
        if (cancelled) return;
        setCategories(categoriesData.categories ?? []);
        setCounts(countsData.counts ?? {});
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
    draft: Pick<CategoryModalDraft, "name" | "icon"> & Partial<Pick<CategoryModalDraft, "color" | "kind">> & { budgetAmount?: number | null },
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

  async function handleDelete() {
    if (!modal) return;
    const { blocked, totalInUse } = await tryDeleteCategories([modal.id], false);
    setModal(null);
    if (blocked.length > 0) setDeleteConfirm({ ids: blocked, inUseCount: totalInUse });
  }

  async function handleBulkDelete() {
    const { blocked, totalInUse } = await tryDeleteCategories([...selection.selectedIds], false);
    if (blocked.length > 0) {
      setDeleteConfirm({ ids: blocked, inUseCount: totalInUse });
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

  return (
    <div>
      <PageHeader title="收支分類" description="支出與收入的分類都在這裡；分類底下可以再開子分類，方便細看同一種消費裡哪種類型花最多" />

      {/* 新增搬到右下角的浮動按鈕（跟首頁新增交易、帳戶類型頁同一招），標題列空出來。 */}
      <FloatingAddButton onClick={() => setBatchTarget({})} label="新增分類" />

      <CategoryModal
        key={modal ? modal.id : "closed"}
        open={modal !== null}
        isSubcategory={!!modal?.parentId}
        parentId={modal?.parentId}
        categories={categories}
        excludeId={modal?.id}
        initial={modal ?? undefined}
        onClose={() => setModal(null)}
        onSave={handleSave}
        // 「未分類」不給刪（見 categories.server.ts 的守門），所以連刪除鈕都不顯示。
        onDelete={modal?.isUncategorized ? undefined : handleDelete}
      />

      <CategoryBatchModal
        key={batchTarget ? (batchTarget.parentId ?? "top") : "closed"}
        open={batchTarget !== null}
        isSubcategory={!!batchTarget?.parentId}
        parentId={batchTarget?.parentId}
        categories={categories}
        lockedKind={kind}
        onClose={() => setBatchTarget(null)}
        onSave={handleBatchSave}
      />

      <ConfirmModal
        open={deleteConfirm !== null}
        title="這些分類還有紀錄"
        message={`選取的分類裡，還有共 ${deleteConfirm?.inUseCount ?? 0} 筆交易或固定收支規則在用。刪除後這些紀錄會自動歸類到「未分類」，不會被刪除也不會變成孤兒資料。確定要刪除嗎？`}
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

      {!ready ? (
        <p className={text.faint}>載入中…</p>
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
                  right={<span className={text.muted}>{counts[c.id] ?? 0} 筆紀錄</span>}
                  leading={selection.selecting && !c.isUncategorized ? <SelectionDot selected={selection.selectedIds.has(c.id)} /> : undefined}
                  onClick={() => (selection.selecting ? (c.isUncategorized ? undefined : selection.toggle(c.id)) : setModal(c))}
                />

                {subs.length > 0 && (
                  <div className="flex flex-col divide-y divide-[#F2EEFA] border-t border-[#ECE4FA] bg-[#F9F7FE]">
                    {subs.map((sub) => (
                      <ListRow
                        key={sub.id}
                        name={sub.name}
                        right={<span className={text.muted}>{counts[sub.id] ?? 0} 筆</span>}
                        leading={selection.selecting ? <SelectionDot selected={selection.selectedIds.has(sub.id)} /> : undefined}
                        onClick={() => (selection.selecting ? selection.toggle(sub.id) : setModal(sub))}
                      />
                    ))}
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
