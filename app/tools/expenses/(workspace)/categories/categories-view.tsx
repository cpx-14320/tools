"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/expenses/page-header";
import { Button } from "@/components/expenses/button";
import { text } from "@/components/expenses/theme";
import { CategoryModal, type CategoryModalDraft } from "@/components/expenses/category-modal";
import {
  topLevelCategories,
  subCategoriesOf,
  categoryColorClass,
  type CategoryDTO,
} from "@/lib/expenses/categories";

type ModalState =
  | { mode: "create-top" }
  | { mode: "create-sub"; parentId: string; parentName: string }
  | { mode: "edit"; category: CategoryDTO };

export function CategoriesView() {
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);

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

  async function handleSave(draft: Pick<CategoryModalDraft, "name" | "icon"> & Partial<Pick<CategoryModalDraft, "color" | "kind">>) {
    if (!modal) return;
    if (modal.mode === "edit") {
      const data: { categories?: CategoryDTO[] } = await fetch("/api/expenses/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: modal.category.id, ...draft }),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (data.categories) setCategories(data.categories);
    } else {
      const parentId = modal.mode === "create-sub" ? modal.parentId : undefined;
      const data: { categories?: CategoryDTO[]; error?: string } = await fetch("/api/expenses/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, parentId }),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (data.categories) {
        setCategories(data.categories);
      } else {
        if (data.error) alert(data.error);
        return;
      }
    }
    setModal(null);
  }

  async function handleDelete() {
    if (modal?.mode !== "edit") return;
    const data: { categories?: CategoryDTO[] } = await fetch(`/api/expenses/categories?id=${modal.category.id}`, { method: "DELETE" })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.categories) setCategories(data.categories);
    setModal(null);
  }

  const parents = topLevelCategories(categories);

  return (
    <div>
      <PageHeader
        title="消費分類"
        description="分類底下可以再開子分類，方便細看同一種消費裡哪種類型花最多"
        actions={<Button onClick={() => setModal({ mode: "create-top" })}>＋ 新增分類</Button>}
      />

      <CategoryModal
        key={modal ? JSON.stringify(modal) : "closed"}
        open={modal !== null}
        isSubcategory={modal?.mode === "create-sub"}
        parentName={modal?.mode === "create-sub" ? modal.parentName : undefined}
        initial={modal?.mode === "edit" ? modal.category : undefined}
        onClose={() => setModal(null)}
        onSave={handleSave}
        onDelete={modal?.mode === "edit" ? handleDelete : undefined}
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
                  onClick={() => setModal({ mode: "edit", category: c })}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                >
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl text-lg ${categoryColorClass[c.color]}`}>
                    {c.icon}
                  </span>
                  <span className={`min-w-0 flex-1 ${text.body}`}>{c.name}</span>
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
                          onClick={() => setModal({ mode: "edit", category: sub })}
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
                    onClick={() => setModal({ mode: "create-sub", parentId: c.id, parentName: c.name })}
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
