// 消費紀錄 CSV 匯出／匯入的純文字處理邏輯。不碰資料庫，伺服器端（import API route 重新
// 驗證一次）跟 client component（匯入頁預覽、匯出頁下載）都直接 import 同一份。

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

export interface CSVTransactionRow {
  date: string;
  categoryId: string;
  amount: number;
  note?: string;
}

/** 消費紀錄轉成 CSV 文字（含標題列）；日期統一用純文字格式，避免 Excel 自動轉成日期序號跑版。 */
export function transactionsToCSV(rows: CSVTransactionRow[], categories: CategoryLookupItem[]): string {
  const header = ["日期", "分類", "金額", "備註"];
  const lines = rows.map((t) =>
    [t.date, categoryPathOf(categories, t.categoryId), t.amount, t.note ?? ""].map(csvEscape).join(","),
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

/** 解析匯入用 CSV：欄位順序比照匯出格式（日期,分類,金額,備註）。分類欄接受
 *  「大分類 › 子分類」路徑格式、也接受只填子分類或大分類名稱；每一列都會驗證，格式不對
 *  的列不會擋住其他列，一起回傳讓畫面列出哪幾列有問題、為什麼。 */
export function parseTransactionsCSV(
  text: string,
  categories: CategoryLookupItem[],
): { results: ImportRowResult[]; validCount: number; invalidCount: number } {
  const rows = parseCSV(text);
  const dataRows = rows.slice(1); // 跳過標題列
  const results: ImportRowResult[] = dataRows.map((cols, idx) => {
    const rowNum = idx + 2;
    const [date, categoryText, amountText, note] = cols;

    if (!date || !isValidISODate(date.trim())) {
      return { row: rowNum, ok: false, error: "日期格式不正確，需要 YYYY-MM-DD 且是存在的日期" };
    }
    const amount = Number(amountText);
    if (!amountText || Number.isNaN(amount) || amount <= 0) {
      return { row: rowNum, ok: false, error: "金額不是有效數字" };
    }
    const leafName = (categoryText ?? "").split("›").pop()?.trim() ?? "";
    const category = categories.find((c) => c.name === leafName);
    if (!category) {
      return { row: rowNum, ok: false, error: `找不到分類「${categoryText?.trim() || "（空白）"}」` };
    }
    return {
      row: rowNum,
      ok: true,
      transaction: { categoryId: category.id, amount, date: date.trim(), note: note?.trim() || undefined },
    };
  });
  return {
    results,
    validCount: results.filter((r) => r.ok).length,
    invalidCount: results.filter((r) => !r.ok).length,
  };
}
