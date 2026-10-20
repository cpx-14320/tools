"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/expenses/page-header";
import { FloatingAddButton } from "@/components/expenses/floating-add-button";
import { SegmentedControl, PillButton } from "@/components/expenses/button";
import { text } from "@/components/expenses/theme";
import { CategoryModal, type CategoryModalDraft } from "@/components/expenses/category-modal";
import { CategoryBatchModal, type CategoryBatchItem } from "@/components/expenses/category-batch-modal";
import { ConfirmModal } from "@/components/expenses/confirm-modal";
import { SelectionBar, SelectionDot } from "@/components/expenses/selection-bar";
import { topLevelCategories, subCategoriesOf, categoryColorClass, type CategoryDTO, type CategoryKind } from "@/lib/expenses/categories";
import { IconAvatar } from "@/components/expenses/icon-avatar";

/** 編輯既有分類／子分類用（點清單裡的一列開啟）；新增（不管頂層還是子分類）都走下面的
 *  batchTarget／CategoryBatchModal，兩種彈窗各自管各自的狀態。 */
type BatchTarget = { parentId?: string; parentName?: string };

export function CategoriesView() {
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<CategoryDTO | null>(null);
  const [batchTarget, setBatchTarget] = useState<BatchTarget | null>(null);
  const [kind, setKind] = useState<CategoryKind>("支出");
  const [deleteConfirm, setDeleteConfirm] = useState<{ ids: string[]; inUseCount: number } | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
    const { blocked, totalInUse } = await tryDeleteCategories([...selectedIds], false);
    if (blocked.length > 0) {
      setDeleteConfirm({ ids: blocked, inUseCount: totalInUse });
    } else {
      setSelecting(false);
      setSelectedIds(new Set());
    }
  }

  async function handleForceDelete() {
    if (!deleteConfirm) return;
    await tryDeleteCategories(deleteConfirm.ids, true);
    setDeleteConfirm(null);
    setSelecting(false);
    setSelectedIds(new Set());
  }

  function toggleSelected(id: string) {
    setSelectedIds((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  return (
    <div>
      <PageHeader title="消費分類" description="分類底下可以再開子分類，方便細看同一種消費裡哪種類型花最多" />

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
        onDelete={handleDelete}
      />

      <CategoryBatchModal
        key={batchTarget ? (batchTarget.parentId ?? "top") : "closed"}
        open={batchTarget !== null}
        isSubcategory={!!batchTarget?.parentId}
        parentName={batchTarget?.parentName}
        parentId={batchTarget?.parentId}
        categories={categories}
        defaultKind={kind}
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
        <PillButton onClick={() => setSelecting((v) => !v)} active={selecting}>
          {selecting ? "完成" : "選取"}
        </PillButton>
      </div>

      {selecting && (
        <SelectionBar
          count={selectedIds.size}
          total={parents.length}
          onToggleAll={() => setSelectedIds((set) => (set.size === parents.length ? new Set() : new Set(parents.map((c) => c.id))))}
          onCancel={() => {
            setSelecting(false);
            setSelectedIds(new Set());
          }}
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
            const count = counts[c.id] ?? 0;
            return (
              <div key={c.id} className="overflow-hidden rounded-2xl border border-[#ECE4FA] bg-white">
                <button
                  type="button"
                  onClick={() => (selecting ? toggleSelected(c.id) : setModal(c))}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                >
                  {selecting && <SelectionDot selected={selectedIds.has(c.id)} />}
                  <IconAvatar icon={c.icon} size="sm" className={categoryColorClass[c.color]} />
                  <span className="min-w-0 flex-1">
                    <span className={`block ${text.body}`}>{c.name}</span>
                  </span>
                  <span className={`shrink-0 ${text.muted}`}>{count} 筆紀錄</span>
                </button>

                {subs.length > 0 && (
                  <div className="flex flex-col divide-y divide-[#F2EEFA] border-t border-[#ECE4FA] bg-[#F9F7FE]">
                    {subs.map((sub) => {
                      const subCount = counts[sub.id] ?? 0;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => setModal(sub)}
                          className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                        >
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
