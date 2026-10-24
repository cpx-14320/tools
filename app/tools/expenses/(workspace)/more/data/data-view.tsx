"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/expenses/card";
import { Button, ButtonLink, SegmentedControl } from "@/components/expenses/button";
import { PageHeader } from "@/components/expenses/page-header";
import { DateField } from "@/components/expenses/date-field";
import { text } from "@/components/expenses/theme";
import {
  transactionsToCSV,
  categoriesToCSV,
  budgetRulesToCSV,
  parseTransactionsCSV,
  parseCategoriesCSV,
  parseBudgetRulesCSV,
  csvTemplate,
  type ImportRowResult,
  type CategoryImportRowResult,
  type BudgetRuleImportRowResult,
} from "@/lib/expenses/csv";
import type { BudgetRuleDTO } from "@/lib/expenses/budgets";
import type { CategoryDTO } from "@/lib/expenses/categories";
import type { TransactionDTO } from "@/lib/expenses/transactions";
import { formatCurrency } from "@/lib/format";

/** 匯出跟匯入本來是兩頁，但它們講的是同一件事（同一組資料、同一種 CSV 格式、同一排
 *  「消費紀錄／消費分類／預算設定」頁籤），而且使用者通常是「在這台匯出、到那台匯入」
 *  一前一後用。合成一頁、上面一個「匯出／匯入」切換，設定頁也少一列。
 *
 *  資料只在這一層抓一次，兩邊共用——匯入完成後更新的分類清單，切回匯出分頁馬上就是
 *  最新的，不用重新整理。 */

type Mode = "export" | "import";
type DataKind = "transactions" | "categories" | "budgets";

const MODES: { value: Mode; label: string }[] = [
  { value: "export", label: "匯出" },
  { value: "import", label: "匯入" },
];

const KINDS: { value: DataKind; label: string }[] = [
  { value: "transactions", label: "消費紀錄" },
  { value: "categories", label: "消費分類" },
  { value: "budgets", label: "預算設定" },
];

const UNIT_LABEL: Record<DataKind, string> = {
  transactions: "筆消費紀錄",
  categories: "個分類",
  budgets: "筆預算設定",
};

const FIELD_HINT: Record<DataKind, string> = {
  transactions: "欄位：日期,分類,金額,備註,明細（薪資那種加項扣項會一起帶出去）",
  categories: "欄位：名稱,收支類型,顏色,上層分類",
  budgets: "欄位：分類,生效月份,每月預算（每一列是一次調整，之後的月份沿用到下一次調整）",
};

const FORMAT_HINT: Record<DataKind, string[]> = {
  transactions: [
    "欄位順序：日期,分類,金額,備註,明細",
    "分類欄可以填完整路徑（例如「餐飲 › 早餐」）或只填分類名稱，分類必須已經存在",
    "明細欄可留空，有填用「本薪:+50000;勞健保:-6000」這種格式",
  ],
  categories: [
    "欄位順序：名稱,收支類型,顏色,上層分類",
    "收支類型填「支出」或「收入」；上層分類留空＝大分類，填名稱＝那個大分類的子分類",
    "顏色填 a～f，留空預設 a。圖示不走 CSV，匯入後在畫面上挑一張就好",
  ],
  budgets: [
    "欄位順序：分類,生效月份,每月預算",
    "一列是一次調整：從生效月份（YYYY-MM）開始套用，之後的月份沿用到下一次調整",
    "分類必須已經存在；金額填 0 代表「從這個月起取消預算」",
  ],
};

const DONE_LINK: Record<DataKind, { href: string; label: string }> = {
  transactions: { href: "/tools/expenses/transactions", label: "查看消費紀錄" },
  categories: { href: "/tools/expenses/categories", label: "查看收支分類" },
  budgets: { href: "/tools/expenses/budgets", label: "查看預算設定" },
};

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

export function DataView() {
  const [mode, setMode] = useState<Mode>("export");
  const [kind, setKind] = useState<DataKind>("transactions");

  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [budgetRules, setBudgetRules] = useState<BudgetRuleDTO[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/expenses/categories").then((res) => res.json()),
      fetch("/api/expenses/transactions").then((res) => res.json()),
      fetch("/api/expenses/budgets").then((res) => res.json()),
    ])
      .then(([categoriesData, txData, budgetsData]: [{ categories?: CategoryDTO[] }, { transactions?: TransactionDTO[] }, { rules?: BudgetRuleDTO[] }]) => {
        if (cancelled) return;
        setCategories(categoriesData.categories ?? []);
        setTransactions(txData.transactions ?? []);
        setBudgetRules(budgetsData.rules ?? []);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <Link href="/tools/expenses/more" className={`mb-3 inline-block font-medium ${text.muted} hover:text-[#6F5FD6]`}>
        ← 設定
      </Link>
      <PageHeader
        title="匯出／匯入資料"
        help="換環境或還原備份時順序是：先匯入消費分類，再匯入預算設定跟消費紀錄——後兩種都要分類已經存在才掛得上去。帳戶類型不走 CSV，在「設定 › 帳戶類型」直接新增就好"
      />

      <SegmentedControl className="mb-3" fullWidth value={mode} onChange={setMode} options={MODES} />
      <SegmentedControl className="mb-4" fullWidth value={kind} onChange={setKind} options={KINDS} />

      {mode === "export" ? (
        <ExportPanel kind={kind} ready={ready} categories={categories} transactions={transactions} budgetRules={budgetRules} />
      ) : (
        <ImportPanel key={kind} kind={kind} categories={categories} onCategoriesChange={setCategories} />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 匯出
// ────────────────────────────────────────────────────────────────────────────

function ExportPanel({
  kind,
  ready,
  categories,
  transactions,
  budgetRules,
}: {
  kind: DataKind;
  ready: boolean;
  categories: CategoryDTO[];
  transactions: TransactionDTO[];
  budgetRules: BudgetRuleDTO[];
}) {
  // 起訖月份預設涵蓋「全部紀錄」，使用者改過才以他改的為準——只存「改成什麼」、
  // 沒改就現算，不用 effect 在資料回來時回頭塞 state（那會多一次重繪，而且跟使用者
  // 的手動修改搶著寫同一個欄位）。
  const [startOverride, setStartOverride] = useState<string | null>(null);
  const [endOverride, setEndOverride] = useState<string | null>(null);
  const months = transactions.map((t) => t.date.slice(0, 7)).sort();
  const start = startOverride ?? months[0] ?? currentYearMonth();
  const end = endOverride ?? months[months.length - 1] ?? currentYearMonth();
  // 備份檔名的日期前綴，掛載時算一次固定住（render 當中讀時鐘是不純的）。
  const [backupStamp] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  });

  // 使用者把起訖拖反了就自動對調，不用擋下來要求重選。
  const [rangeStart, rangeEnd] = start <= end ? [start, end] : [end, start];
  const rows = useMemo(
    () => transactions.filter((t) => t.date.slice(0, 7) >= rangeStart && t.date.slice(0, 7) <= rangeEnd).sort((a, b) => (a.date < b.date ? -1 : 1)),
    [transactions, rangeStart, rangeEnd],
  );
  const total = rows.reduce((sum, t) => sum + t.amount, 0);
  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  // 三份一起下載。檔名統一加上日期前綴，多備份幾次時排序起來就是時間序，不會互相蓋掉。
  // 瀏覽器對連續觸發的下載會做節流，所以每份之間隔一點點時間再觸發下一份。
  function handleFullBackup() {
    const allTx = [...transactions].sort((a, b) => (a.date < b.date ? -1 : 1));
    const files: [string, string][] = [
      [`${backupStamp}_消費分類.csv`, categoriesToCSV(categories)],
      [`${backupStamp}_預算設定.csv`, budgetRulesToCSV(budgetRules, nameById)],
      [`${backupStamp}_消費紀錄.csv`, transactionsToCSV(allTx, categories)],
    ];
    files.forEach(([name, csv], i) => {
      window.setTimeout(() => downloadCSV(name, csv), i * 400);
    });
  }

  function handleExport() {
    if (kind === "transactions") {
      downloadCSV(`消費紀錄_${rangeStart}_至_${rangeEnd}.csv`, transactionsToCSV(rows, categories));
    } else if (kind === "categories") {
      downloadCSV("消費分類.csv", categoriesToCSV(categories));
    } else {
      downloadCSV("預算設定.csv", budgetRulesToCSV(budgetRules, nameById));
    }
  }

  const count = kind === "transactions" ? rows.length : kind === "categories" ? categories.length : budgetRules.length;

  return (
    <div className="flex flex-col gap-4">
      {/* 完整備份：三份檔案一次下載，省得自己切三次分頁、也不會漏掉其中一份。
          一次觸發多個下載，瀏覽器可能會問「是否允許下載多個檔案」，這是正常的。 */}
      <Card>
        <CardBody className="flex flex-col gap-3">
          <div>
            <p className={text.body}>完整備份</p>
            <p className={`mt-0.5 ${text.faint}`}>一次下載分類、預算設定、全部消費紀錄共 3 個檔案</p>
          </div>
          <Button onClick={handleFullBackup} disabled={!ready}>
            ⬇ 下載完整備份（3 個檔）
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-4">
          {kind === "transactions" && (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={`font-medium ${text.muted}`}>起始月份</span>
                <DateField value={start} onChange={setStartOverride} granularity="month" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={`font-medium ${text.muted}`}>結束月份</span>
                <DateField value={end} onChange={setEndOverride} granularity="month" />
              </label>
            </div>
          )}

          <div className="rounded-xl bg-[#F9F7FE] p-4">
            {kind === "transactions" && (
              <>
                <p className={text.muted}>
                  {rangeStart} ～ {rangeEnd}
                </p>
                <p className="mt-1 text-sm text-[#4A3B7C]">
                  共 <span className="font-semibold tabular-nums">{rows.length}</span> 筆，合計{" "}
                  <span className="font-semibold tabular-nums">{formatCurrency(total)}</span>
                </p>
              </>
            )}
            {kind === "categories" && (
              <p className="text-sm text-[#4A3B7C]">
                共 <span className="font-semibold tabular-nums">{categories.length}</span> 個分類（含子分類）
              </p>
            )}
            {kind === "budgets" && (
              <p className="text-sm text-[#4A3B7C]">
                共 <span className="font-semibold tabular-nums">{budgetRules.length}</span> 筆預算調整紀錄
              </p>
            )}
            <p className={`mt-1 ${text.faint}`}>{FIELD_HINT[kind]}</p>
          </div>

          <Button onClick={handleExport} disabled={!ready || count === 0}>
            ⬇ 下載 CSV（{count} 筆）
          </Button>
          {ready && count === 0 && <p className={`text-center ${text.muted}`}>目前沒有可以匯出的資料。</p>}
        </CardBody>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 匯入
// ────────────────────────────────────────────────────────────────────────────

type Stage = "pick" | "preview" | "done";

/** 三種主檔的匯入共用同一個流程（選檔→預覽→確認匯入），只是解析器跟送出的 API 不同。
 *
 *  預覽把每一列分成三種：可以匯入、已經有了（略過）、格式有問題。中間那種不是錯誤——
 *  新帳號一進記帳本就自動建好一整套預設分類，把分類備份匯回新環境時幾乎每一列都會
 *  撞名，混進「有問題」裡會變成滿滿一片紅字，看起來像整個檔案壞掉。 */
function ImportPanel({
  kind,
  categories,
  onCategoriesChange,
}: {
  kind: DataKind;
  categories: CategoryDTO[];
  onCategoriesChange: (categories: CategoryDTO[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("pick");
  const [fileName, setFileName] = useState("");
  const [txResults, setTxResults] = useState<ImportRowResult[]>([]);
  const [catResults, setCatResults] = useState<CategoryImportRowResult[]>([]);
  const [budgetResults, setBudgetResults] = useState<BudgetRuleImportRowResult[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [parseError, setParseError] = useState<string | null>(null);

  const results: { row: number; ok: boolean; skipped?: boolean; error?: string }[] =
    kind === "transactions" ? txResults : kind === "categories" ? catResults : budgetResults;
  const validCount = results.filter((r) => r.ok).length;
  const skipped = results.filter((r) => !r.ok && r.skipped);
  const problems = results.filter((r) => !r.ok && !r.skipped);

  function handleDownloadTemplate() {
    const label = KINDS.find((k) => k.value === kind)?.label ?? "資料";
    // 開頭加 UTF-8 BOM，不然 Windows 版 Excel 會把中文標頭猜成別的編碼變亂碼。
    downloadCSV(`${label}_範本.csv`, csvTemplate(kind));
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
      } else {
        // 同名的子分類（像兩個大分類底下都有「其他」）在這裡以第一個為準；預算目前
        // 只設在大分類上，先不為了這個把 CSV 欄位改成完整路徑。
        const idByName = new Map<string, string>();
        for (const c of categories) if (!idByName.has(c.name)) idByName.set(c.name, c.id);
        const { results } = parseBudgetRulesCSV(content, idByName);
        if (results.length === 0) return setParseError(emptyMessage);
        setBudgetResults(results);
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
  // 沒有上層分類的列排前面再送。圖示不走 CSV，由後端給預設的共用圖（見 csv.ts）。
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
        body: JSON.stringify({ name: item.name, color: item.color, kind: item.kind, parentId: parent?.id }),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (!data.categories) continue;
      latest = data.categories;
      created++;
    }
    onCategoriesChange(latest);
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

  async function handleConfirmImport() {
    if (kind === "transactions") await importTransactions();
    else if (kind === "categories") await importCategories();
    else await importBudgetRules();
    setStage("done");
  }

  function reset() {
    setStage("pick");
    setTxResults([]);
    setCatResults([]);
    setBudgetResults([]);
    setFileName("");
    setParseError(null);
    setDuplicateCount(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  const unitLabel = UNIT_LABEL[kind];
  const doneLink = DONE_LINK[kind];

  if (stage === "preview") {
    return (
      <div className="flex flex-col gap-4">
        <Card>
          <CardBody>
            <p className={`truncate ${text.body}`}>{fileName}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <p className="text-[#4A3B7C]">
                可匯入 <span className="font-semibold text-[#2FAE82]">{validCount}</span> {unitLabel}
              </p>
              {skipped.length > 0 && (
                <p className="text-[#4A3B7C]">
                  已經有了 <span className="font-semibold text-[#9C94C4]">{skipped.length}</span> 列
                </p>
              )}
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
              <p className="text-sm font-semibold text-[#D1517E]">以下列格式有問題，不會匯入</p>
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

        {/* 已經有的那些另外列一張淡色的卡，不用紅字——這是正常結果，不是要使用者處理
            的問題。列數多的時候只給總數，不用把一整排「已經有了」攤開佔滿畫面。 */}
        {skipped.length > 0 && (
          <Card>
            <CardBody>
              <p className={text.body}>
                有 {skipped.length} 列系統裡已經有了，會自動略過
              </p>
              <p className={`mt-1 ${text.faint}`}>{skipped.slice(0, 8).map((r) => r.error).join("、")}{skipped.length > 8 ? " …" : ""}</p>
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
    );
  }

  if (stage === "done") {
    return (
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
    );
  }

  return (
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
  );
}
