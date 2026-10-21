"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/expenses/card";
import { Button, ButtonLink, SegmentedControl } from "@/components/expenses/button";
import { PageHeader } from "@/components/expenses/page-header";
import { text } from "@/components/expenses/theme";
import {
  parseTransactionsCSV,
  parseCategoriesCSV,
  parseAccountTypesCSV,
  parseBudgetRulesCSV,
  csvTemplate,
  type ImportRowResult,
  type CategoryImportRowResult,
  type AccountTypeImportRowResult,
  type BudgetRuleImportRowResult,
} from "@/lib/expenses/csv";
import type { BudgetRuleDTO } from "@/lib/expenses/budgets";
import type { CategoryDTO } from "@/lib/expenses/categories";
import type { AccountTypeDTO } from "@/lib/expenses/account-types";

type Stage = "pick" | "preview" | "done";
type ImportKind = "transactions" | "categories" | "budgets" | "accountTypes";

const KINDS: { value: ImportKind; label: string }[] = [
  { value: "transactions", label: "消費紀錄" },
  { value: "categories", label: "消費分類" },
  { value: "budgets", label: "預算設定" },
  { value: "accountTypes", label: "帳戶類型" },
];

const FORMAT_HINT: Record<ImportKind, string[]> = {
  transactions: [
    "欄位順序：日期,分類,金額,備註,明細",
    "分類欄可以填完整路徑（例如「網購 › 服飾美妝」）或只填分類名稱，分類必須已經存在",
    "明細欄可留空，有填用「本薪:+50000;勞健保:-6000」這種格式",
  ],
  categories: [
    "欄位順序：名稱,收支類型,圖示,顏色,上層分類",
    "收支類型填「支出」或「收入」；上層分類留空＝大分類，填名稱＝那個大分類的子分類",
    "顏色填 a～f，留空預設 a",
  ],
  budgets: [
    "欄位順序：分類,生效月份,每月預算",
    "一列是一次調整：從生效月份（YYYY-MM）開始套用，之後的月份沿用到下一次調整",
    "分類必須已經存在；金額填 0 代表「從這個月起取消預算」",
  ],
  accountTypes: ["欄位順序：名稱,資產負債,圖示", "資產負債填「資產」或「負債」，建立後不能更改", "圖示留空會給一個預設的 🏦"],
};

const UNIT_LABEL: Record<ImportKind, string> = {
  transactions: "筆消費紀錄",
  categories: "個分類",
  budgets: "筆預算設定",
  accountTypes: "個帳戶類型",
};

const DONE_LINK: Record<ImportKind, { href: string; label: string }> = {
  transactions: { href: "/tools/expenses/transactions", label: "查看消費紀錄" },
  categories: { href: "/tools/expenses/categories", label: "查看收支分類" },
  budgets: { href: "/tools/expenses/budgets", label: "查看預算設定" },
  accountTypes: { href: "/tools/expenses/account-types", label: "查看帳戶類型" },
};

/** 四種主檔的匯入共用同一個流程（選檔→預覽→確認匯入），只是解析器、送出的 API、
 *  以及「這一列代表什麼」不同。預覽階段一律列出哪幾列有問題、為什麼，有問題的列
 *  會被略過，不會擋住其他列。 */
export function ImportView() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const [kind, setKind] = useState<ImportKind>("transactions");
  const [stage, setStage] = useState<Stage>("pick");
  const [fileName, setFileName] = useState("");
  const [txResults, setTxResults] = useState<ImportRowResult[]>([]);
  const [catResults, setCatResults] = useState<CategoryImportRowResult[]>([]);
  const [budgetResults, setBudgetResults] = useState<BudgetRuleImportRowResult[]>([]);
  const [typeResults, setTypeResults] = useState<AccountTypeImportRowResult[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/expenses/categories").then((res) => res.json()),
      fetch("/api/expenses/account-types").then((res) => res.json()),
    ])
      .then(([catData, typeData]: [{ categories?: CategoryDTO[] }, { accountTypes?: AccountTypeDTO[] }]) => {
        setCategories(catData.categories ?? []);
        setAccountTypes(typeData.accountTypes ?? []);
      })
      .catch(() => {});
  }, []);

  const results: { row: number; ok: boolean; error?: string }[] =
    kind === "transactions" ? txResults : kind === "categories" ? catResults : kind === "budgets" ? budgetResults : typeResults;
  const problems = results.filter((r) => !r.ok);
  const validCount = results.filter((r) => r.ok).length;

  function handleDownloadTemplate() {
    const label = KINDS.find((k) => k.value === kind)?.label ?? "資料";
    // 開頭加 UTF-8 BOM，不然 Windows 版 Excel 會把中文標頭猜成別的編碼變亂碼。
    const blob = new Blob(["﻿" + csvTemplate(kind)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${label}_範本.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    setParseError(null);
    setFileName(file.name);
    const emptyMessage = "這個檔案裡沒有找到可以解析的資料列，確認一下格式是不是對的。";
    try {
      const content = await file.text();
      if (kind === "transactions") {
        const { results } = parseTransactionsCSV(content, categories);
        if (results.length === 0) return setParseError(emptyMessage);
        setTxResults(results);
      } else if (kind === "categories") {
        const nameById = new Map(categories.map((c) => [c.id, c.name]));
        const { results } = parseCategoriesCSV(content, categories, nameById);
        if (results.length === 0) return setParseError(emptyMessage);
        setCatResults(results);
      } else if (kind === "budgets") {
        // 同名的子分類（像兩個大分類底下都有「其他」）在這裡以第一個為準；預算目前
        // 只設在大分類上，先不為了這個把 CSV 欄位改成完整路徑。
        const idByName = new Map<string, string>();
        for (const c of categories) if (!idByName.has(c.name)) idByName.set(c.name, c.id);
        const { results } = parseBudgetRulesCSV(content, idByName);
        if (results.length === 0) return setParseError(emptyMessage);
        setBudgetResults(results);
      } else {
        const existing = accountTypes.map((t) => ({ name: t.name, kind: t.kind === "asset" ? ("資產" as const) : ("負債" as const) }));
        const { results } = parseAccountTypesCSV(content, existing);
        if (results.length === 0) return setParseError(emptyMessage);
        setTypeResults(results);
      }
      setStage("preview");
    } catch {
      setParseError("讀取檔案失敗，確認一下是不是 CSV 文字檔。");
    }
  }

  async function importTransactions() {
    const rows = txResults.filter((r) => r.ok && r.transaction).map((r) => r.transaction);
    const data: { count?: number; duplicates?: number } = await fetch("/api/expenses/transactions/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    setImportedCount(data.count ?? 0);
    setDuplicateCount(data.duplicates ?? 0);
  }

  // 逐筆依序 POST（不是 Promise.all 併發）：新分類的 order 是用當下已存在筆數算出來的，
  // 併發送出會拿到同一個 order。大分類一定要先建好，子分類才找得到 parentId，所以把
  // 沒有上層分類的列排前面再送。
  async function importCategories() {
    const valid = catResults.flatMap((r) => (r.ok && r.category ? [r.category] : []));
    const ordered = [...valid.filter((c) => !c.parentName), ...valid.filter((c) => c.parentName)];
    let latest = categories;
    let created = 0;
    for (const item of ordered) {
      const parent = item.parentName ? latest.find((c) => !c.parentId && c.name === item.parentName && c.kind === item.kind) : undefined;
      if (item.parentName && !parent) continue; // 找不到上層分類就跳過，預覽階段已經提示過
      const data: { categories?: CategoryDTO[] } = await fetch("/api/expenses/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: item.name, icon: item.icon, color: item.color, kind: item.kind, parentId: parent?.id }),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (!data.categories) continue;
      latest = data.categories;
      created++;
    }
    setCategories(latest);
    setImportedCount(created);
    setDuplicateCount(0);
  }

  // 預算是用 (分類, 生效月份) 做 upsert，所以同一個組合重送只會覆蓋、不會變成兩筆。
  async function importBudgetRules() {
    const valid = budgetResults.flatMap((r) => (r.ok && r.rule ? [r.rule] : []));
    const idByName = new Map<string, string>();
    for (const c of categories) if (!idByName.has(c.name)) idByName.set(c.name, c.id);
    let created = 0;
    for (const item of valid) {
      const categoryId = idByName.get(item.categoryName);
      if (!categoryId) continue;
      const data: { rules?: BudgetRuleDTO[] } = await fetch("/api/expenses/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, effectiveFrom: item.effectiveFrom, amount: item.amount }),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (data.rules) created++;
    }
    setImportedCount(created);
    setDuplicateCount(0);
  }

  async function importAccountTypes() {
    const valid = typeResults.flatMap((r) => (r.ok && r.accountType ? [r.accountType] : []));
    let latest = accountTypes;
    let created = 0;
    for (const item of valid) {
      const data: { accountTypes?: AccountTypeDTO[] } = await fetch("/api/expenses/account-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: item.name, icon: item.icon, kind: item.kind === "資產" ? "asset" : "liability" }),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (!data.accountTypes) continue;
      latest = data.accountTypes;
      created++;
    }
    setAccountTypes(latest);
    setImportedCount(created);
    setDuplicateCount(0);
  }

  async function handleConfirmImport() {
    if (kind === "transactions") await importTransactions();
    else if (kind === "categories") await importCategories();
    else if (kind === "budgets") await importBudgetRules();
    else await importAccountTypes();
    setStage("done");
  }

  function reset() {
    setStage("pick");
    setTxResults([]);
    setCatResults([]);
    setBudgetResults([]);
    setTypeResults([]);
    setFileName("");
    setParseError(null);
    setDuplicateCount(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  const unitLabel = UNIT_LABEL[kind];
  const doneLink = DONE_LINK[kind];

  return (
    <div>
      <Link href="/tools/expenses/more" className={`mb-3 inline-block font-medium ${text.muted} hover:text-[#6F5FD6]`}>
        ← 設定
      </Link>
      <PageHeader title="匯入資料" description="換環境或還原備份時，先匯入消費分類跟帳戶類型，再匯入預算設定跟消費紀錄" />

      <SegmentedControl
        className="mb-4"
        fullWidth
        value={kind}
        onChange={(k) => {
          setKind(k);
          reset();
        }}
        options={KINDS}
      />

      {stage === "pick" && (
        <Card>
          <CardBody className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="text-3xl">📥</span>
            <div>
              <p className={text.body}>選擇 CSV 檔案</p>
              <div className={`mt-1 flex flex-col gap-0.5 ${text.faint}`}>
                {FORMAT_HINT[kind].map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
            <Button onClick={() => fileRef.current?.click()}>選擇檔案</Button>
            {/* 還沒有任何資料時，先下載範本在試算表裡排好再匯入，比在手機上一個一個
                點彈窗建立快得多；範本裡的範例列可以直接改成自己的資料。 */}
            <button type="button" onClick={handleDownloadTemplate} className="text-xs font-medium text-[#6F5FD6] hover:underline">
              下載 {KINDS.find((k) => k.value === kind)?.label} 範本 CSV
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            {parseError && <p className="text-sm text-[#D1517E]">{parseError}</p>}
          </CardBody>
        </Card>
      )}

      {stage === "preview" && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardBody>
              <p className={`truncate ${text.body}`}>{fileName}</p>
              <div className="mt-3 flex gap-4 text-sm">
                <p className="text-[#4A3B7C]">
                  可匯入 <span className="font-semibold text-[#2FAE82]">{validCount}</span> {unitLabel}
                </p>
                {problems.length > 0 && (
                  <p className="text-[#4A3B7C]">
                    有問題 <span className="font-semibold text-[#D1517E]">{problems.length}</span> 列
                  </p>
                )}
              </div>
            </CardBody>
          </Card>

          {problems.length > 0 && (
            <Card>
              <CardBody>
                <p className="text-sm font-semibold text-[#D1517E]">以下列會被略過，不會匯入</p>
                <ul className="mt-2 flex flex-col divide-y divide-[#F2EEFA]">
                  {problems.map((r) => (
                    <li key={r.row} className="py-2 text-sm text-[#4A3B7C]">
                      <span className="font-medium">第 {r.row} 列</span>
                      <span className={text.muted}>　{r.error}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" onClick={reset} className="flex-1">
              重新選擇
            </Button>
            <Button onClick={handleConfirmImport} disabled={validCount === 0} className="flex-1">
              確認匯入 {validCount} 筆
            </Button>
          </div>
        </div>
      )}

      {stage === "done" && (
        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="text-3xl">✅</span>
            <p className={text.body}>
              已匯入 {importedCount} {unitLabel}
            </p>
            {duplicateCount > 0 && <p className={text.faint}>其中 {duplicateCount} 筆跟現有紀錄完全相同，已自動略過</p>}
            <div className="mt-2 flex gap-3">
              <Button variant="secondary" onClick={reset}>
                再匯入一次
              </Button>
              <ButtonLink href={doneLink.href}>{doneLink.label}</ButtonLink>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
