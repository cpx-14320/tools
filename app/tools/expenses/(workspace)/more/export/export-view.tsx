"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/expenses/card";
import { Button, SegmentedControl } from "@/components/expenses/button";
import { PageHeader } from "@/components/expenses/page-header";
import { DateField } from "@/components/expenses/date-field";
import { text } from "@/components/expenses/theme";
import { transactionsToCSV, categoriesToCSV, accountTypesToCSV, budgetRulesToCSV } from "@/lib/expenses/csv";
import type { BudgetRuleDTO } from "@/lib/expenses/budgets";
import type { CategoryDTO } from "@/lib/expenses/categories";
import type { AccountTypeDTO } from "@/lib/expenses/account-types";
import type { TransactionDTO } from "@/lib/expenses/transactions";
import { formatCurrency } from "@/lib/format";

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** 開頭加 UTF-8 BOM，不然 Windows 版 Excel 常常會把中文欄位猜成別的編碼，整份變亂碼。 */
function downloadCSV(filename: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type ExportKind = "transactions" | "categories" | "budgets" | "accountTypes";

const KINDS: { value: ExportKind; label: string }[] = [
  { value: "transactions", label: "消費紀錄" },
  { value: "categories", label: "消費分類" },
  { value: "budgets", label: "預算設定" },
  { value: "accountTypes", label: "帳戶類型" },
];

export function ExportView() {
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [budgetRules, setBudgetRules] = useState<BudgetRuleDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [kind, setKind] = useState<ExportKind>("transactions");
  const [start, setStart] = useState(currentYearMonth());
  const [end, setEnd] = useState(currentYearMonth());
  // 備份檔名的日期前綴，掛載時算一次固定住（render 當中讀時鐘是不純的）。
  const [backupStamp] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/expenses/categories").then((res) => res.json()),
      fetch("/api/expenses/transactions").then((res) => res.json()),
      fetch("/api/expenses/account-types").then((res) => res.json()),
      fetch("/api/expenses/budgets").then((res) => res.json()),
    ])
      .then(
        ([categoriesData, txData, typesData, budgetsData]: [
          { categories?: CategoryDTO[] },
          { transactions?: TransactionDTO[] },
          { accountTypes?: AccountTypeDTO[] },
          { rules?: BudgetRuleDTO[] },
        ]) => {
          if (cancelled) return;
          const tx = txData.transactions ?? [];
          setCategories(categoriesData.categories ?? []);
          setAccountTypes(typesData.accountTypes ?? []);
          setTransactions(tx);
          setBudgetRules(budgetsData.rules ?? []);
          if (tx.length > 0) {
            const months = tx.map((t) => t.date.slice(0, 7)).sort();
            setStart(months[0]);
            setEnd(months[months.length - 1]);
          }
          setReady(true);
        },
      )
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

  // 四份一起下載。檔名統一加上日期前綴，多備份幾次時排序起來就是時間序，不會互相蓋掉。
  // 瀏覽器對連續觸發的下載會做節流，所以每份之間隔一點點時間再觸發下一份。
  function handleFullBackup() {
    const stamp = backupStamp;
    const nameById = new Map(categories.map((c) => [c.id, c.name]));
    const allTx = [...transactions].sort((a, b) => (a.date < b.date ? -1 : 1));
    const files: [string, string][] = [
      [`${stamp}_消費分類.csv`, categoriesToCSV(categories)],
      [`${stamp}_帳戶類型.csv`, accountTypesToCSV(accountTypes.map((t) => ({ ...t, kind: t.kind === "asset" ? "資產" : "負債" })))],
      [`${stamp}_預算設定.csv`, budgetRulesToCSV(budgetRules, nameById)],
      [`${stamp}_消費紀錄.csv`, transactionsToCSV(allTx, categories)],
    ];
    files.forEach(([name, csv], i) => {
      window.setTimeout(() => downloadCSV(name, csv), i * 400);
    });
  }

  function handleExport() {
    if (kind === "transactions") {
      downloadCSV(`消費紀錄_${rangeStart}_至_${rangeEnd}.csv`, transactionsToCSV(rows, categories));
      return;
    }
    if (kind === "categories") {
      downloadCSV("消費分類.csv", categoriesToCSV(categories));
      return;
    }
    if (kind === "budgets") {
      downloadCSV("預算設定.csv", budgetRulesToCSV(budgetRules, new Map(categories.map((c) => [c.id, c.name]))));
      return;
    }
    downloadCSV("帳戶類型.csv", accountTypesToCSV(accountTypes.map((t) => ({ ...t, kind: t.kind === "asset" ? "資產" : "負債" }))));
  }

  const count =
    kind === "transactions" ? rows.length : kind === "categories" ? categories.length : kind === "budgets" ? budgetRules.length : accountTypes.length;

  return (
    <div>
      <Link href="/tools/expenses/more" className={`mb-3 inline-block font-medium ${text.muted} hover:text-[#6F5FD6]`}>
        ← 設定
      </Link>
      <PageHeader title="匯出資料" description="消費紀錄可以選月份區間；其他三種是整份匯出，換環境或還原備份時先匯入分類跟帳戶類型，再匯入預算跟消費紀錄" />

      {/* 完整備份：四份檔案一次下載，省得自己切四次分頁、也不會漏掉其中一份。
          一次觸發多個下載，瀏覽器可能會問「是否允許下載多個檔案」，這是正常的。 */}
      <Card className="mb-4">
        <CardBody className="flex flex-col gap-3">
          <div>
            <p className={text.body}>完整備份</p>
            <p className={`mt-0.5 ${text.faint}`}>一次下載分類、帳戶類型、預算設定、全部消費紀錄共 4 個檔案</p>
          </div>
          <Button onClick={handleFullBackup} disabled={!ready}>
            ⬇ 下載完整備份（4 個檔）
          </Button>
        </CardBody>
      </Card>

      <p className={`mb-2 ${text.label}`}>或分別匯出</p>
      <SegmentedControl className="mb-4" fullWidth value={kind} onChange={setKind} options={KINDS} />

      <Card>
        <CardBody className="flex flex-col gap-4">
          {kind === "transactions" && (
            <>
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
                <p className={`mt-1 ${text.faint}`}>欄位：日期,分類,金額,備註,明細（薪資那種加項扣項會一起帶出去）</p>
              </div>
            </>
          )}

          {kind === "categories" && (
            <div className="rounded-xl bg-[#F9F7FE] p-4">
              <p className="text-sm text-[#4A3B7C]">
                共 <span className="font-semibold tabular-nums">{categories.length}</span> 個分類（含子分類）
              </p>
              <p className={`mt-1 ${text.faint}`}>欄位：名稱,收支類型,圖示,顏色,上層分類</p>
            </div>
          )}

          {kind === "budgets" && (
            <div className="rounded-xl bg-[#F9F7FE] p-4">
              <p className="text-sm text-[#4A3B7C]">
                共 <span className="font-semibold tabular-nums">{budgetRules.length}</span> 筆預算調整紀錄
              </p>
              <p className={`mt-1 ${text.faint}`}>欄位：分類,生效月份,每月預算（每一列是一次調整，之後的月份沿用到下一次調整）</p>
            </div>
          )}

          {kind === "accountTypes" && (
            <div className="rounded-xl bg-[#F9F7FE] p-4">
              <p className="text-sm text-[#4A3B7C]">
                共 <span className="font-semibold tabular-nums">{accountTypes.length}</span> 個帳戶類型
              </p>
              <p className={`mt-1 ${text.faint}`}>欄位：名稱,資產負債,圖示</p>
            </div>
          )}

          <Button onClick={handleExport} disabled={!ready || count === 0}>
            ⬇ 下載 CSV（{count} 筆）
          </Button>
          {ready && count === 0 && <p className={`text-center ${text.muted}`}>目前沒有可以匯出的資料。</p>}
        </CardBody>
      </Card>
    </div>
  );
}
