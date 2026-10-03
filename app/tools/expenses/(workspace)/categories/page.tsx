import type { Metadata } from "next";
import { PageHeader, Button } from "@/components/ui";
import { topLevelCategories, subCategoriesOf, categoryColorClass, transactions } from "@/lib/mock-data";

export const metadata: Metadata = { title: "消費分類" };

export default function CategoriesPage() {
  const parents = topLevelCategories();

  return (
    <div>
      <PageHeader
        title="消費分類"
        description="帳本共用；分類底下可以再開子分類，方便細看同一種消費裡哪種類型花最多"
        actions={<Button>＋ 新增分類</Button>}
      />

      <div className="flex flex-col gap-3">
        {parents.map((c) => {
          const subs = subCategoriesOf(c.id);
          const count = transactions.filter((t) => t.categoryId === c.id).length;
          return (
            <div key={c.id} className="overflow-hidden rounded-[1.5rem] border border-line bg-surface">
              <div className="flex items-center gap-3 px-4 py-3.5">
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl text-lg ${categoryColorClass[c.color]}`}>
                  {c.icon}
                </span>
                <span className="min-w-0 flex-1 font-medium">{c.name}</span>
                <span className="shrink-0 text-xs text-muted">{count} 筆紀錄</span>
              </div>

              {subs.length > 0 && (
                <div className="flex flex-col divide-y divide-line border-t border-line bg-surface-2/60 pl-6">
                  {subs.map((sub) => {
                    const subCount = transactions.filter((t) => t.categoryId === sub.id).length;
                    return (
                      <div key={sub.id} className="flex items-center gap-3 py-2.5 pr-4">
                        <span aria-hidden className="text-muted">
                          ↳
                        </span>
                        <span className={`grid size-8 shrink-0 place-items-center rounded-lg text-sm ${categoryColorClass[sub.color]}`}>
                          {sub.icon}
                        </span>
                        <span className="min-w-0 flex-1 text-sm">{sub.name}</span>
                        <span className="shrink-0 text-xs text-muted">{subCount} 筆</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="border-t border-line px-4 py-2">
                <button type="button" className="text-xs font-medium text-brand hover:underline">
                  ＋ 新增「{c.name}」的子分類
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
