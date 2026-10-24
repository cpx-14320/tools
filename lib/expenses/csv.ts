// 消費紀錄 CSV 匯出／匯入的純文字處理邏輯。不碰資料庫，伺服器端（import API route 重新
// 驗證一次）跟 client component（匯入頁預覽、匯出頁下載）都直接 import 同一份。

export interface AccountLookupItem {
  id: string;
  name: string;
}

export interface CategoryLookupItem {
  id: string;
  name: string;
  parentId?: string;
}

/** 分類顯示用路徑：子分類回傳「大分類 › 子分類」，大分類直接回傳自己的名字。 */
export function categoryPathOf(categories: CategoryLookupItem[], id: string): string {
  const cat = categories.find((c) => c.id === id);
  if (!cat) return "（已刪除分類）";
  if (!cat.parentId) return cat.name;
  const parent = categories.find((c) => c.id === cat.parentId);
  return parent ? `${parent.name} › ${cat.name}` : cat.name;
}

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 明細的淨額（加項減扣項）。跟 transactions.ts 的 breakdownNet 算的是同一件事，但
 *  這裡刻意不 import：csv.ts 是給伺服器端的 import route 跟瀏覽器端的匯入頁共用的
 *  純文字處理，不想為了一行加總把整個交易邏輯模組拉進來。 */
function netOf(items: CSVBreakdownItem[]): number {
  return items.reduce((sum, i) => sum + (i.kind === "扣項" ? -i.amount : i.amount), 0);
}

export interface CSVBreakdownItem {
  label: string;
  kind: "加項" | "扣項";
  amount: number;
}

export interface CSVTransactionRow {
  date: string;
  categoryId: string;
  amount: number;
  note?: string;
  breakdown?: CSVBreakdownItem[];
  /** 這筆記在哪個帳戶（現金錢包、銀行帳戶…）；沒指定帳戶就是 undefined。 */
  accountId?: string;
}

/** 明細（薪資的本薪／勞健保那種加項扣項）在 CSV 裡壓成一欄文字：
 *  `本薪:+50000;勞健保:-6000`——加項前面是 +、扣項是 -，項目之間用分號隔開。
 *  用分號不用逗號，才不會跟 CSV 本身的欄位分隔打架；真的有逗號的標籤還是會被
 *  csvEscape 正確加引號包起來。 */
export function breakdownToText(breakdown: CSVBreakdownItem[] | undefined): string {
  if (!breakdown || breakdown.length === 0) return "";
  return breakdown.map((b) => `${b.label}:${b.kind === "扣項" ? "-" : "+"}${b.amount}`).join(";");
}

/** breakdownToText 的反向解析。
 *
 *  標準寫法是 `本薪:+50000`，但在試算表裡手打很容易漏掉冒號變成 `本薪+50000`——
 *  後面的 +/- 本來就已經把標籤跟金額分開了，所以沒有冒號也照樣收。真正無法解析的
 *  項目才跳過（不會讓整列進不來）；標籤本身可能含有冒號，所以用最後一個冒號切。 */
export function parseBreakdownText(text: string | undefined): CSVBreakdownItem[] {
  if (!text || !text.trim()) return [];
  const items: CSVBreakdownItem[] = [];
  for (const chunk of text.split(";")) {
    const piece = chunk.trim();
    if (!piece) continue;

    let label: string;
    let valueText: string;
    const colon = piece.lastIndexOf(":");
    if (colon > 0) {
      label = piece.slice(0, colon).trim();
      valueText = piece.slice(colon + 1).trim();
    } else {
      // 沒有冒號：從最後一個 +/- 切開，那個符號同時也是加項／扣項的標記。
      const sign = Math.max(piece.lastIndexOf("+"), piece.lastIndexOf("-"));
      if (sign <= 0) continue;
      label = piece.slice(0, sign).trim();
      valueText = piece.slice(sign).trim();
    }

    const amount = Math.abs(Number(valueText));
    if (!label || !Number.isFinite(amount) || amount <= 0) continue;
    items.push({ label, kind: valueText.startsWith("-") ? "扣項" : "加項", amount });
  }
  return items;
}

/** 消費紀錄轉成 CSV 文字（含標題列）；日期統一用純文字格式，避免 Excel 自動轉成日期序號跑版。
 *  明細欄沒有明細的紀錄就是空字串，匯入時可以原樣還原回來。
 *
 *  帳戶欄放最後：絕大多數的紀錄不會指定帳戶（記帳時那一欄本來就收在「更多」裡），放
 *  前面只會讓整份檔案中間空一長條。帳戶跟分類一樣用名稱對應。 */
export function transactionsToCSV(rows: CSVTransactionRow[], categories: CategoryLookupItem[], accounts: AccountLookupItem[] = []): string {
  const header = ["日期", "分類", "金額", "備註", "明細", "帳戶"];
  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));
  const lines = rows.map((t) =>
    [
      t.date,
      categoryPathOf(categories, t.categoryId),
      t.amount,
      t.note ?? "",
      breakdownToText(t.breakdown),
      t.accountId ? (accountNameById.get(t.accountId) ?? "") : "",
    ]
      .map(csvEscape)
      .join(","),
  );
  return [header.join(","), ...lines].join("\r\n");
}

/** 格式是 YYYY-MM-DD 還不夠，"2026-13-99" 也會過這個正規表示式——用 Date 轉一圈回來比對，
 *  月份／日期超出範圍時 Date 會自動「進位」到別的日子，跟原始輸入對不上就代表不是真的日期。 */
export function isValidISODate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split("-").map(Number);
  const parsed = new Date(y, m - 1, d);
  return parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d;
}

/** 把日期欄位整理成 YYYY-MM-DD。
 *
 *  匯出的是 2026-01-05 這種純文字，但只要在 Excel 裡打開再存一次，它就會自作主張
 *  改成 2026/1/5（甚至 2026/1/5 上午 12:00:00）。使用者沒有做錯任何事，不該因為
 *  開過一次 Excel 就整份匯不進來——斜線換成橫線、月份日期補零，再交給嚴格的
 *  isValidISODate 檢查。真的不成樣子的值還是會被擋下。 */
export function normalizeDateCell(raw: string | undefined): string {
  const text = (raw ?? "").trim();
  // Excel 可能在後面接時間（"2026/1/5 上午 12:00:00"），只取前面那段日期。
  const datePart = text.split(/[\sT]/)[0];
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(datePart);
  if (!m) return datePart;
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** 簡單的 CSV 文字解析器，支援雙引號欄位、欄位內的逗號／換行／跳脫雙引號（""）。 */
function parseCSV(text: string): string[][] {
  const s = text.replace(/^﻿/, ""); // 去掉可能的 UTF-8 BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cur += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(cur);
      cur = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export interface ImportRowResult {
  row: number; // 第幾列（含標題列，資料從第 2 列開始），給錯誤訊息定位用
  ok: boolean;
  error?: string;
  transaction?: CSVTransactionRow;
}

/** 解析匯入用 CSV：欄位順序比照匯出格式（日期,分類,金額,備註,明細）。分類欄接受
 *  「大分類 › 子分類」路徑格式、也接受只填子分類或大分類名稱；明細欄可以留空，有填的話
 *  用 `本薪:+50000;勞健保:-6000` 這種格式。每一列都會驗證，格式不對的列不會擋住其他列，
 *  一起回傳讓畫面列出哪幾列有問題、為什麼。
 *
 *  相容舊檔：沒有「明細」那一欄的舊匯出檔（只有四欄）一樣可以匯入，明細就是空的。 */
/** 把 CSV 的分類欄對應到真正的分類。
 *
 *  欄位可以填完整路徑「薪水 › 春酒禮金」或只填名稱「春酒禮金」。以前一律只取最後一段
 *  去比名稱，填了路徑也是白填——而同一個名稱在不同大分類底下（甚至同時存在一個同名的
 *  頂層分類）是完全合法的，比到誰純粹看分類清單的順序。實際發生過：「春酒禮金」同時
 *  存在於「薪水」底下跟頂層，匯入時全部掛到頂層那個，報表上就變成一個獨立的大分類，
 *  而不是在「薪水」展開的細項裡。
 *
 *  所以：有填路徑就用路徑比對（父名稱＋子名稱都要對）；只填名稱而且剛好只有一個同名
 *  分類就用那個；同名的有好幾個就擋下來請使用者寫完整路徑，不要替他猜。 */
function matchCategory(categories: CategoryLookupItem[], cell: string): { category: CategoryLookupItem } | { error: string } {
  const text = cell.trim();
  if (!text) return { error: "找不到分類「（空白）」" };

  const parts = text.split("›").map((p) => p.trim());
  const leafName = parts[parts.length - 1];
  const parentName = parts.length > 1 ? parts[parts.length - 2] : "";
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const sameName = categories.filter((c) => c.name === leafName);

  if (sameName.length === 0) return { error: `找不到分類「${text}」` };

  if (parentName) {
    const hit = sameName.find((c) => c.parentId && nameById.get(c.parentId) === parentName);
    if (!hit) return { error: `找不到分類「${text}」——「${parentName}」底下沒有「${leafName}」` };
    return { category: hit };
  }

  if (sameName.length > 1) {
    const paths = sameName.map((c) => (c.parentId ? `${nameById.get(c.parentId) ?? "?"} › ${c.name}` : `${c.name}（大分類）`));
    return { error: `有 ${sameName.length} 個分類都叫「${leafName}」（${paths.join("、")}），請改填完整路徑` };
  }
  return { category: sameName[0] };
}

export function parseTransactionsCSV(
  text: string,
  categories: CategoryLookupItem[],
  accounts: AccountLookupItem[] = [],
): { results: ImportRowResult[]; validCount: number; invalidCount: number } {
  const rows = parseCSV(text);
  const dataRows = rows.slice(1); // 跳過標題列
  const results: ImportRowResult[] = dataRows.map((cols, idx) => {
    const rowNum = idx + 2;
    const [dateText, categoryText, amountText, note, breakdownText, accountText] = cols;

    const date = normalizeDateCell(dateText);
    if (!date || !isValidISODate(date)) {
      return { row: rowNum, ok: false, error: "日期格式不正確，需要 YYYY-MM-DD 且是存在的日期" };
    }
    const amount = Number(amountText);
    if (!amountText || Number.isNaN(amount) || amount <= 0) {
      return { row: rowNum, ok: false, error: "金額不是有效數字" };
    }
    const matched = matchCategory(categories, categoryText ?? "");
    if ("error" in matched) return { row: rowNum, ok: false, error: matched.error };
    const category = matched.category;

    // 有填明細的話，加項減扣項要剛好等於金額欄——app 裡的明細本來就是「金額由明細
    // 加總算出來」（見 transaction-modal.tsx），兩邊兜不起來一定是有一項打錯或漏掉。
    // 以前是默默照金額欄匯進去，少掉的那一項不會有任何提示。
    const breakdown = parseBreakdownText(breakdownText);
    if (breakdown.length > 0) {
      const net = netOf(breakdown);
      if (net !== amount) {
        return {
          row: rowNum,
          ok: false,
          error: `明細加減起來是 ${net}，跟金額欄的 ${amount} 對不起來（差 ${Math.abs(amount - net)}）`,
        };
      }
    }

    // 帳戶欄可以留空（絕大多數紀錄不指定帳戶）；有填就一定要對得到既有的帳戶，
    // 打錯字默默當成「不指定帳戶」匯進去的話，餘額會莫名其妙少一截。
    const accountName = (accountText ?? "").trim();
    const account = accountName ? accounts.find((a) => a.name === accountName) : undefined;
    if (accountName && !account) {
      return { row: rowNum, ok: false, error: `找不到帳戶「${accountName}」，請先在「資產總表」建立` };
    }

    return {
      row: rowNum,
      ok: true,
      transaction: {
        categoryId: category.id,
        amount,
        date,
        note: note?.trim() || undefined,
        breakdown: breakdown.length > 0 ? breakdown : undefined,
        accountId: account?.id,
      },
    };
  });
  return {
    results,
    validCount: results.filter((r) => r.ok).length,
    invalidCount: results.filter((r) => !r.ok).length,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 分類的匯出入
//
// 消費紀錄的 CSV 只能引用「已經存在」的分類（見 parseTransactionsCSV 找不到分類就報錯），
// 所以換新環境／還原備份時順序是：先匯入分類，再匯入預算跟消費紀錄。
//
// 沒有「圖示」欄：分類的 icon 存的是圖檔路徑（見 lib/expenses/presets.ts），而畫面上
// 是從一組固定的圖裡挑，不是自己打路徑——在試算表裡手打一串 /expenses/xxx.png 只會
// 打錯變破圖。匯入進來的分類一律先給共用的「其他」圖，之後在畫面上挑一張就好。
//
// 帳戶類型也不走 CSV：那是一份一輩子大概只會設定一次、而且只有三五筆的清單，在畫面上
// 新增比開試算表快，為它維護一種檔案格式划不來。
// ────────────────────────────────────────────────────────────────────────────

export type CSVCategoryKind = "支出" | "收入";

export interface CSVCategoryItem {
  name: string;
  kind: CSVCategoryKind;
  color: string;
  /** 空字串＝頂層分類；有值＝這是那個大分類底下的子分類（用名稱對應）。 */
  parentName: string;
}

/** 分類（含子分類）轉成 CSV。頂層分類排在前面、子分類排在後面——匯入時要先有父分類
 *  才建得出子分類，排好順序匯入端就不用再自己拓撲排序。 */
export function categoriesToCSV(
  categories: { id: string; name: string; kind: CSVCategoryKind; icon: string; color: string; parentId?: string }[],
): string {
  const header = ["名稱", "收支類型", "圖示", "顏色", "上層分類"];
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const ordered = [...categories.filter((c) => !c.parentId), ...categories.filter((c) => c.parentId)];
  const lines = ordered.map((c) =>
    [c.name, c.kind, c.icon, c.color, c.parentId ? (nameById.get(c.parentId) ?? "") : ""].map(csvEscape).join(","),
  );
  return [header.join(","), ...lines].join("\r\n");
}

export interface CategoryImportRowResult {
  row: number;
  ok: boolean;
  /** 「這一列沒問題，只是已經有了」——跟真正的格式錯誤分開算。
   *
   *  新帳號一進記帳本就會自動建好一整套預設分類（餐飲、交通、早餐…，見 presets.ts），
   *  所以把分類備份匯回新環境時，幾乎每一列都會撞名。那不是錯誤，是正常的略過；
   *  混在「有問題」裡會變成滿滿一片紅字，看起來像整個檔案壞掉。 */
  skipped?: boolean;
  error?: string;
  category?: CSVCategoryItem;
}

/** 解析分類匯入 CSV（名稱,收支類型,圖示,顏色,上層分類）。顏色留空或填不認得的
 *  值一律當成 a，圖示留空給一個預設標籤圖示——這兩個欄位缺了不影響分類本身能不能用，
 *  不值得為了它們擋下整列。同一批裡自己人撞名、或是跟系統裡已經存在的分類撞名都會被擋下
 *  （同一個父分類底下、同一種收支類型不能有兩個同名分類，跟畫面上的新增規則一致）。 */
export function parseCategoriesCSV(
  text: string,
  existing: { name: string; kind: string; parentId?: string }[],
  existingNameById: Map<string, string>,
): { results: CategoryImportRowResult[]; validCount: number; invalidCount: number; skippedCount: number } {
  const rows = parseCSV(text);
  const dataRows = rows.slice(1);
  const seen = new Set<string>();
  const existingKeys = new Set(
    existing.map((c) => `${c.kind}::${c.parentId ? (existingNameById.get(c.parentId) ?? "") : ""}::${c.name}`),
  );

  const results: CategoryImportRowResult[] = dataRows.map((cols, idx) => {
    const rowNum = idx + 2;
    const [nameText, kindText, colorText, parentText] = cols;
    const name = (nameText ?? "").trim();
    const kind = (kindText ?? "").trim();
    const parentName = (parentText ?? "").trim();

    if (!name) return { row: rowNum, ok: false, error: "分類名稱不能空白" };
    if (kind !== "支出" && kind !== "收入") {
      return { row: rowNum, ok: false, error: `收支類型要填「支出」或「收入」，目前是「${kind || "（空白）"}」` };
    }

    // 撞名是 skipped 不是錯誤（見 CategoryImportRowResult.skipped）。
    const key = `${kind}::${parentName}::${name}`;
    if (existingKeys.has(key)) {
      return { row: rowNum, ok: false, skipped: true, error: `「${name}」已經有了` };
    }
    if (seen.has(key)) {
      return { row: rowNum, ok: false, skipped: true, error: `這個檔案裡「${name}」重複出現，只建立一次` };
    }
    seen.add(key);

    const color = (colorText ?? "").trim().toLowerCase();

    return {
      row: rowNum,
      ok: true,
      category: { name, kind, color: /^[a-f]$/.test(color) ? color : "a", parentName },
    };
  });

  return {
    results,
    validCount: results.filter((r) => r.ok).length,
    invalidCount: results.filter((r) => !r.ok && !r.skipped).length,
    skippedCount: results.filter((r) => r.skipped).length,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// CSV 範本
// 給「還沒有任何資料、想先用試算表把分類跟預算規劃好再一次匯入」的情境用：每一種檔案
// 給一份含標頭跟幾列範例的空白檔，使用者照著改就好，不用自己猜欄位順序跟允許的值。
// 範例列故意用最常見的那幾個分類，直接匯入也是一組能用的起手式。
// ────────────────────────────────────────────────────────────────────────────

export type CSVTemplateKind = "transactions" | "categories" | "budgets";

const CSV_TEMPLATES: Record<CSVTemplateKind, string[][]> = {
  transactions: [
    ["日期", "分類", "金額", "備註", "明細", "帳戶"],
    ["2026-01-05", "早餐", "120", "", "", "現金錢包"],
    ["2026-01-05", "月票", "1200", "", "", ""],
    ["2026-01-10", "月薪", "44000", "一月薪資", "本薪:+50000;勞健保:-6000", "銀行帳戶"],
  ],
  categories: [
    ["名稱", "收支類型", "顏色", "上層分類"],
    ["餐飲", "支出", "a", ""],
    ["交通", "支出", "b", ""],
    ["薪水", "收入", "c", ""],
    ["早餐", "支出", "a", "餐飲"],
    // 大分類一旦有子項目就不能直接記帳（見 categories.ts 的 needsSubcategory），
    // 所以「薪水」底下一定要跟著一個收薪水用的項目，不然消費紀錄範本的那一列會
    // 找不到分類。
    ["月薪", "收入", "c", "薪水"],
  ],
  budgets: [
    ["分類", "生效月份", "每月預算"],
    ["餐飲", "2026-01", "8000"],
    ["交通", "2026-01", "2000"],
    ["餐飲", "2026-07", "9000"],
  ],
};

export function csvTemplate(kind: CSVTemplateKind): string {
  return CSV_TEMPLATES[kind].map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

// ────────────────────────────────────────────────────────────────────────────
// 預算設定
// 預算是「從某個月開始生效、之後沿用到下一次調整」的規則，不是每個月各填一次，
// 所以匯出的是「調整紀錄」本身（分類＋生效月份＋金額），不是每月一列的快照。
// 金額 0 代表「從這個月起不設預算」，所以這裡允許 0，只擋負數。
// ────────────────────────────────────────────────────────────────────────────

export interface CSVBudgetRuleItem {
  categoryName: string;
  effectiveFrom: string;
  amount: number;
}

export function budgetRulesToCSV(
  rules: { categoryId: string; effectiveFrom: string; amount: number }[],
  categoryNameById: Map<string, string>,
): string {
  const header = ["分類", "生效月份", "每月預算"];
  const ordered = [...rules]
    .filter((r) => categoryNameById.has(r.categoryId))
    .sort((a, b) => {
      const an = categoryNameById.get(a.categoryId) ?? "";
      const bn = categoryNameById.get(b.categoryId) ?? "";
      return an === bn ? a.effectiveFrom.localeCompare(b.effectiveFrom) : an.localeCompare(bn);
    });
  const lines = ordered.map((r) =>
    [categoryNameById.get(r.categoryId) ?? "", r.effectiveFrom, r.amount].map(csvEscape).join(","),
  );
  return [header.join(","), ...lines].join("\r\n");
}

export interface BudgetRuleImportRowResult {
  row: number;
  ok: boolean;
  error?: string;
  rule?: CSVBudgetRuleItem;
}

/** 解析預算匯入 CSV（分類,生效月份,每月預算）。分類用名稱對應系統裡既有的分類，
 *  對不到就擋下那一列——預算一定掛在某個已經存在的分類上，不會順手幫忙建分類
 *  （要建分類請先匯入分類檔）。同一個分類同一個月份重複出現時以最後一列為準，
 *  因為後端本來就是用 (分類, 生效月份) 做 upsert。 */
export function parseBudgetRulesCSV(
  text: string,
  categoryIdByName: Map<string, string>,
): { results: BudgetRuleImportRowResult[]; validCount: number; invalidCount: number } {
  const rows = parseCSV(text);
  const dataRows = rows.slice(1);

  const results: BudgetRuleImportRowResult[] = dataRows.map((cols, idx) => {
    const rowNum = idx + 2;
    const [nameText, monthText, amountText] = cols;
    const categoryName = (nameText ?? "").trim();
    const effectiveFrom = (monthText ?? "").trim();
    const amountRaw = (amountText ?? "").trim();

    if (!categoryName) return { row: rowNum, ok: false, error: "分類名稱不能空白" };
    if (!categoryIdByName.has(categoryName)) {
      return { row: rowNum, ok: false, error: `找不到分類「${categoryName}」，請先匯入分類` };
    }
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(effectiveFrom)) {
      return { row: rowNum, ok: false, error: `生效月份要是 YYYY-MM，目前是「${effectiveFrom || "（空白）"}」` };
    }
    const amount = Number(amountRaw);
    if (!amountRaw || !Number.isFinite(amount) || amount < 0) {
      return { row: rowNum, ok: false, error: "每月預算不是有效數字（0 代表取消預算）" };
    }

    return { row: rowNum, ok: true, rule: { categoryName, effectiveFrom, amount } };
  });

  return {
    results,
    validCount: results.filter((r) => r.ok).length,
    invalidCount: results.filter((r) => !r.ok).length,
  };
}
