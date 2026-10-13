"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/expenses/card";
import { Button } from "@/components/expenses/button";
import { PageHeader } from "@/components/expenses/page-header";
import { DateField } from "@/components/expenses/date-field";
import { text } from "@/components/expenses/theme";
import { transactionsToCSV } from "@/lib/expenses/csv";
import type { CategoryDTO } from "@/lib/expenses/categories";
import type { TransactionDTO } from "@/lib/expenses/transactions";
import { formatCurrency } from "@/lib/format";

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function ExportView() {
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [start, setStart] = useState(currentYearMonth());
  const [end, setEnd] = useState(currentYearMonth());

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/expenses/categories").then((res) => res.json()),
      fetch("/api/expenses/transactions").then((res) => res.json()),
    ])
      .then(([categoriesData, txData]: [{ categories?: CategoryDTO[] }, { transactions?: TransactionDTO[] }]) => {
        if (cancelled) return;
        const tx = txData.transactions ?? [];
        setCategories(categoriesData.categories ?? []);
        setTransactions(tx);
        if (tx.length > 0) {
          const months = tx.map((t) => t.date.slice(0, 7)).sort();
          setStart(months[0]);
          setEnd(months[months.length - 1]);
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 使用者把起訖拖反了就自動對調，不用擋下來要求重選。
  const [rangeStart, rangeEnd] = start <= end ? [start, end] : [end, start];
  const rows = useMemo(
    () => transactions.filter((t) => t.date.slice(0, 7) >= rangeStart && t.date.slice(0, 7) <= rangeEnd).sort((a, b) => (a.date < b.date ? -1 : 1)),
    [transactions, rangeStart, rangeEnd],
  );
  const total = rows.reduce((sum, t) => sum + t.amount, 0);

  function handleExport() {
    // 開頭加 UTF-8 BOM，不然 Windows 版 Excel 常常會把中文欄位猜成別的編碼，整份變亂碼。
    const csv = "﻿" + transactionsToCSV(rows, categories);
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
      <Link href="/tools/expenses/more" className={`mb-3 inline-block font-medium ${text.muted} hover:text-[#6F5FD6]`}>
        ← 更多
      </Link>
      <PageHeader title="匯出資料" description="選擇月份區間，匯出成 CSV 檔案" />

      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={`font-medium ${text.muted}`}>起始月份</span>
              <DateField value={start} onChange={setStart} granularity="month" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={`font-medium ${text.muted}`}>結束月份</span>
              <DateField value={end} onChange={setEnd} granularity="month" />
            </label>
          </div>

          <div className="rounded-xl bg-[#F9F7FE] p-4">
            <p className={text.muted}>
              {rangeStart} ～ {rangeEnd}
            </p>
            <p className="mt-1 text-sm text-[#4A3B7C]">
              共 <span className="font-semibold tabular-nums">{rows.length}</span> 筆，合計{" "}
              <span className="font-semibold tabular-nums">{formatCurrency(total)}</span>
            </p>
          </div>

          <Button onClick={handleExport} disabled={!ready || rows.length === 0}>
            ⬇ 下載 CSV（{rows.length} 筆）
          </Button>
          {ready && rows.length === 0 && <p className={`text-center ${text.muted}`}>這個區間沒有消費紀錄可以匯出。</p>}
        </CardBody>
      </Card>
    </div>
  );
}
