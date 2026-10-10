"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardBody, Button, PageHeader } from "@/components/ui";
import {
  transactionDateRange,
  transactionsInRange,
  transactionsToCSV,
} from "@/lib/expenses/mock-data";
import { formatCurrency } from "@/lib/format";

export function ExportView() {
  const range = transactionDateRange();
  const [start, setStart] = useState(range.min);
  const [end, setEnd] = useState(range.max);

  // 使用者把起訖拖反了就自動對調，不用擋下來要求重選。
  const [rangeStart, rangeEnd] = start <= end ? [start, end] : [end, start];
  const rows = useMemo(() => transactionsInRange(rangeStart, rangeEnd), [rangeStart, rangeEnd]);
  const total = rows.reduce((sum, t) => sum + t.amount, 0);

  function handleExport() {
    // 開頭加 UTF-8 BOM，不然 Windows 版 Excel 常常會把中文欄位猜成別的編碼，整份變亂碼。
    const csv = "﻿" + transactionsToCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `消費紀錄_${rangeStart}_至_${rangeEnd}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <Link href="/tools/expenses/more" className="mb-3 inline-block text-xs font-medium text-muted hover:text-ink">
        ← 更多
      </Link>
      <PageHeader title="匯出資料" description="選擇月份區間，匯出成 CSV 檔案" />

      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">起始月份</span>
              <input
                type="month"
                value={start}
                min={range.min}
                max={range.max}
                onChange={(e) => setStart(e.target.value)}
                className="rounded-full border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">結束月份</span>
              <input
                type="month"
                value={end}
                min={range.min}
                max={range.max}
                onChange={(e) => setEnd(e.target.value)}
                className="rounded-full border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
          </div>

          <div className="rounded-xl bg-surface-2 p-4">
            <p className="text-xs text-muted">
              {rangeStart} ～ {rangeEnd}
            </p>
            <p className="mt-1 text-sm">
              共 <span className="font-semibold tabular-nums">{rows.length}</span> 筆，合計{" "}
              <span className="font-semibold tabular-nums">{formatCurrency(total)}</span>
            </p>
          </div>

          <Button onClick={handleExport} disabled={rows.length === 0}>
            ⬇ 下載 CSV（{rows.length} 筆）
          </Button>
          {rows.length === 0 && <p className="text-center text-xs text-muted">這個區間沒有消費紀錄可以匯出。</p>}
        </CardBody>
      </Card>
    </div>
  );
}
