"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/expenses/card";
import { Button } from "@/components/expenses/button";
import { PageHeader } from "@/components/expenses/page-header";
import { DateField } from "@/components/expenses/date-field";
import { text } from "@/components/expenses/theme";
import { salaryItemsToCSV, type CSVSalaryItemRow } from "@/lib/expenses/csv";
import { salaryNet, type SalaryRecordDTO } from "@/lib/expenses/salary-records";
import type { SalaryItemTypeDTO } from "@/lib/expenses/salary-types";
import { formatCurrency } from "@/lib/format";

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function SalaryExportView() {
  const [records, setRecords] = useState<SalaryRecordDTO[]>([]);
  const [types, setTypes] = useState<SalaryItemTypeDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [start, setStart] = useState(currentYearMonth());
  const [end, setEnd] = useState(currentYearMonth());

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/expenses/salary-records").then((res) => res.json()),
      fetch("/api/expenses/salary-types").then((res) => res.json()),
    ])
      .then(([recordsData, typesData]: [{ records?: SalaryRecordDTO[] }, { types?: SalaryItemTypeDTO[] }]) => {
        if (cancelled) return;
        const recs = recordsData.records ?? [];
        setRecords(recs);
        setTypes(typesData.types ?? []);
        if (recs.length > 0) {
          const months = recs.map((r) => r.yearMonth).sort();
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
  const recordsInRange = useMemo(
    () => records.filter((r) => r.yearMonth >= rangeStart && r.yearMonth <= rangeEnd).sort((a, b) => (a.yearMonth < b.yearMonth ? -1 : 1)),
    [records, rangeStart, rangeEnd],
  );
  const rows: CSVSalaryItemRow[] = recordsInRange.flatMap((r) => r.items.map((i) => ({ yearMonth: r.yearMonth, typeId: i.typeId, amount: i.amount })));
  const totalNet = recordsInRange.reduce((sum, r) => sum + salaryNet(r, types), 0);

  function handleExport() {
    // 開頭加 UTF-8 BOM，不然 Windows 版 Excel 常常會把中文欄位猜成別的編碼，整份變亂碼。
    const csv = "﻿" + salaryItemsToCSV(rows, types);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `薪資紀錄_${rangeStart}_至_${rangeEnd}.csv`;
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
      <PageHeader title="匯出薪資紀錄" description="選擇月份區間，匯出成 CSV 檔案" />

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
              共 <span className="font-semibold tabular-nums">{recordsInRange.length}</span> 個月，淨額合計{" "}
              <span className="font-semibold tabular-nums">{formatCurrency(totalNet)}</span>
            </p>
          </div>

          <Button onClick={handleExport} disabled={!ready || rows.length === 0}>
            ⬇ 下載 CSV（{recordsInRange.length} 個月）
          </Button>
          {ready && rows.length === 0 && <p className={`text-center ${text.muted}`}>這個區間沒有薪資紀錄可以匯出。</p>}
        </CardBody>
      </Card>
    </div>
  );
}
