"use client";

import { useState } from "react";
import { Button, Card, CardBody, DeltaBadge } from "@/components/ui";
import { DateFilterPicker } from "@/components/date-filter-picker";
import { useDateFilter } from "@/components/date-filter-context";
import {
  transactions,
  categoryById,
  categoryColorClass,
  categoryPath,
  memberName,
  members,
  formatCurrency,
  dateFilterRange,
  previousPeriodSuffix,
  rangeDelta,
  totalsForRange,
  type Transaction,
  type CategoryKind,
} from "@/lib/mock-data";

function matchesQuery(t: Transaction, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [t.note, categoryPath(t.categoryId), memberName(t.memberId), t.date].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(q);
}

export function TransactionsView() {
  const { filter } = useDateFilter();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<CategoryKind>("支出");
  const isSearching = query.trim().length > 0;
  const range = dateFilterRange(filter);

  const inKind = (t: Transaction) => (categoryById(t.categoryId)?.kind ?? "支出") === kind;

  const rows = (isSearching ? transactions.filter(inKind) : totalsForRange(range)[kind === "支出" ? "expenseTx" : "incomeTx"])
    .filter((t) => matchesQuery(t, query))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const total = rows.reduce((sum, t) => sum + t.amount, 0);
  const delta = rangeDelta((r) => totalsForRange(r)[kind === "支出" ? "totalExpense" : "extraIncome"], filter);
  const deltaSuffix = previousPeriodSuffix(filter.mode);

  // 依日期分組，App 常見的「日期當小標題」條列方式；搜尋時日期標題本身就能告訴使用者是哪個時間。
  const groups = new Map<string, typeof rows>();
  for (const t of rows) {
    const list = groups.get(t.date) ?? [];
    list.push(t);
    groups.set(t.date, list);
  }

  return (
    <div>
      <DateFilterPicker className="mb-4" />

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-0.5 rounded-full border border-line bg-surface p-1">
          {(["支出", "收入"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                kind === k ? "bg-brand text-brand-fg" : "text-muted hover:text-ink"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        <Button>＋ 新增</Button>
      </div>

      <label className="mb-4 flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5">
        <span aria-hidden className="text-muted">
          🔍
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`搜尋備註、分類或記錄人⋯不限${filter.mode === "all" ? "" : "期間"}`}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
        />
      </label>

      {isSearching ? (
        <p className="mb-4 px-1 text-xs text-muted">
          「{query.trim()}」在所有時間的{kind}紀錄中共 {rows.length} 筆符合，不受上方日期篩選影響
        </p>
      ) : (
        rows.length > 0 && (
          <Card className="mb-4">
            <CardBody className="flex items-center justify-between py-3.5">
              <div>
                <p className="text-xs text-muted">這段期間共{kind === "支出" ? "花費" : "收入"}</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums">{formatCurrency(total)}</p>
              </div>
              {delta && (
                <DeltaBadge delta={delta.delta} pct={delta.pct} goodWhenUp={kind === "收入"} suffix={deltaSuffix} />
              )}
            </CardBody>
          </Card>
        )
      )}

      {rows.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-center text-sm text-muted">
            {isSearching ? "沒有符合的紀錄。" : `這段期間還沒有${kind}紀錄。`}
          </CardBody>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {[...groups.entries()].map(([date, items]) => (
            <div key={date}>
              <p className="mb-1.5 px-1 text-xs font-medium text-muted">{date}</p>
              <div className="flex flex-col divide-y divide-line overflow-hidden rounded-[1.5rem] border border-line bg-surface">
                {items.map((t) => {
                  const category = categoryById(t.categoryId);
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                      <span
                        className={`grid size-10 shrink-0 place-items-center rounded-xl text-lg ${category ? categoryColorClass[category.color] : "bg-surface-2"}`}
                      >
                        {category?.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{t.note ?? category?.name}</p>
                        <p className="truncate text-xs text-muted">
                          {categoryPath(t.categoryId)}
                          {members.length > 1 ? ` · ${memberName(t.memberId)}` : ""}
                        </p>
                      </div>
                      <span className={`shrink-0 tabular-nums font-semibold ${kind === "收入" ? "text-positive" : ""}`}>
                        {kind === "收入" ? "＋" : ""}
                        {formatCurrency(t.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
