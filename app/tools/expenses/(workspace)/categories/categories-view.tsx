"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/expenses/page-header";
import { Button } from "@/components/expenses/button";
import { text } from "@/components/expenses/theme";
import { CategoryModal, type CategoryModalDraft } from "@/components/expenses/category-modal";
import { CategoryBatchModal, type CategoryBatchItem } from "@/components/expenses/category-batch-modal";
import {
  topLevelCategories,
  subCategoriesOf,
  categoryColorClass,
  DEFAULT_CATEGORIES,
  type CategoryDTO,
} from "@/lib/expenses/categories";
import { formatCurrency } from "@/lib/format";

/** 編輯既有分類／子分類用（點清單裡的一列開啟）；新增（不管頂層還是子分類）都走下面的
 *  batchTarget／CategoryBatchModal，兩種彈窗各自管各自的狀態。 */
type BatchTarget = { parentId?: string; parentName?: string };

export function CategoriesView() {
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<CategoryDTO | null>(null);
  const [batchTarget, setBatchTarget] = useState<BatchTarget | null>(null);

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

  async function handleDelete() {
    if (!modal) return;
    const data: { categories?: CategoryDTO[] } = await fetch(`/api/expenses/categories?id=${modal.id}`, { method: "DELETE" })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.categories) setCategories(data.categories);
    setModal(null);
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

  // 套用常見分類：跳過名稱（同收支類型下）已經存在的項目，不會建出重複分類；可以
  // 重複點，缺哪個補哪個，不是只有第一次沒分類時才能用。一樣依序送出，理由跟批次
  // 新增相同。
  async function handleApplyDefaults() {
    const existingNames = new Set(categories.map((c) => `${c.kind}:${c.name}`));
    const toCreate = DEFAULT_CATEGORIES.filter((d) => !existingNames.has(`${d.kind}:${d.name}`));
    if (toCreate.length === 0) return;
    let latest = categories;
    for (const item of toCreate) {
      const data: { categories?: CategoryDTO[] } = await fetch("/api/expenses/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (data.categories) latest = data.categories;
    }
    setCategories(latest);
  }

  const parents = topLevelCategories(categories);

  return (
    <div>
      <PageHeader
        title="消費分類"
        description="分類底下可以再開子分類，方便細看同一種消費裡哪種類型花最多"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleApplyDefaults}>
              套用常見分類
            </Button>
            <Button onClick={() => setBatchTarget({})}>＋ 新增分類</Button>
          </div>
        }
      />

      <CategoryModal
        key={modal ? modal.id : "closed"}
        open={modal !== null}
        isSubcategory={!!modal?.parentId}
        initial={modal ?? undefined}
        onClose={() => setModal(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <CategoryBatchModal
        key={batchTarget ? (batchTarget.parentId ?? "top") : "closed"}
        open={batchTarget !== null}
        isSubcategory={!!batchTarget?.parentId}
        parentName={batchTarget?.parentName}
        onClose={() => setBatchTarget(null)}
        onSave={handleBatchSave}
      />

      {!ready ? (
        <p className={text.faint}>載入中…</p>
      ) : parents.length === 0 ? (
        <p className={text.faint}>還沒有任何分類，點上方新增第一個分類</p>
      ) : (
        <div className="flex flex-col gap-3">
          {parents.map((c) => {
            const subs = subCategoriesOf(categories, c.id);
            const count = counts[c.id] ?? 0;
            return (
              <div key={c.id} className="overflow-hidden rounded-2xl border border-[#ECE4FA] bg-white">
                <button
                  type="button"
                  onClick={() => setModal(c)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                >
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl text-lg ${categoryColorClass[c.color]}`}>
                    {c.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block ${text.body}`}>{c.name}</span>
                    {!!c.budgetAmount && <span className={`block ${text.muted}`}>預算 {formatCurrency(c.budgetAmount)}／月</span>}
                  </span>
                  <span className={`shrink-0 ${text.muted}`}>{count} 筆紀錄</span>
                </button>

                {subs.length > 0 && (
                  <div className="flex flex-col divide-y divide-[#F2EEFA] border-t border-[#ECE4FA] bg-[#F9F7FE] pl-6">
                    {subs.map((sub) => {
                      const subCount = counts[sub.id] ?? 0;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => setModal(sub)}
                          className="flex w-full items-center gap-3 py-2.5 pr-4 text-left"
                        >
                          <span aria-hidden className="text-[#9C94C4]">
                            ↳
                          </span>
                          <span className={`grid size-8 shrink-0 place-items-center rounded-lg text-sm ${categoryColorClass[sub.color]}`}>
                            {sub.icon}
                          </span>
                          <span className="min-w-0 flex-1 text-sm font-medium text-[#4A3B7C]">{sub.name}</span>
                          <span className={`shrink-0 ${text.muted}`}>{subCount} 筆</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="border-t border-[#ECE4FA] px-4 py-2">
                  <button
                    type="button"
                    onClick={() => setBatchTarget({ parentId: c.id, parentName: c.name })}
                    className="text-xs font-medium text-[#6F5FD6] hover:underline"
                  >
                    ＋ 新增「{c.name}」的子分類
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
