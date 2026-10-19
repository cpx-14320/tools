// 純邏輯、不碰資料庫——只有型別跟用 CategoryDTO[] 當參數的 pure function，client component
// 可以安全 import。真的要讀寫資料庫的 CRUD 在同資料夾的 categories.server.ts，那邊會 import
// 到 `mongodb` 套件，不能被瀏覽器端的程式碼 import 到（那個套件用了 tls/net/child_process
// 這些 Node-only 模組，打包進瀏覽器會整個炸掉）。

export type CategoryColor = "a" | "b" | "c" | "d" | "e" | "f";
export type CategoryKind = "支出" | "收入";

export interface CategoryDTO {
  id: string;
  name: string;
  icon: string;
  color: CategoryColor;
  kind: CategoryKind;
  parentId?: string;
  /** 系統預設建立的分類——「清除全部資料」不會刪掉它們。 */
  isPreset?: boolean;
  /** 每月預算，只對頂層「支出」分類有意義——子分類跟收入分類沒有自己的預算，花費算進
   *  它們的頂層大分類裡一起比對。沒填代表這個分類沒設預算。 */
  budgetAmount?: number;
}

export function topLevelCategories(categories: CategoryDTO[], kind?: CategoryKind): CategoryDTO[] {
  return categories.filter((c) => !c.parentId && (kind === undefined || c.kind === kind));
}

export function subCategoriesOf(categories: CategoryDTO[], parentId: string): CategoryDTO[] {
  return categories.filter((c) => c.parentId === parentId);
}

export function categoryById(categories: CategoryDTO[], id: string): CategoryDTO | undefined {
  return categories.find((c) => c.id === id);
}

/** 分類顯示用路徑：子分類回傳「大分類 › 子分類」，大分類直接回傳自己的名字。 */
export function categoryPath(categories: CategoryDTO[], id: string): string {
  const cat = categoryById(categories, id);
  if (!cat) return "（已刪除分類）";
  if (!cat.parentId) return cat.name;
  const parent = categoryById(categories, cat.parentId);
  return parent ? `${parent.name} › ${cat.name}` : cat.name;
}

/** 子分類算到它的大分類底下，拿不到大分類（理論上不會發生）就算它自己——給「消費分類佔比」這種
 *  只看大分類的彙總畫面用；要看子分類細節到分類管理頁，那裡會列出每個大分類底下的子分類明細。 */
export function topLevelCategoryId(categories: CategoryDTO[], id: string): string {
  const cat = categoryById(categories, id);
  return cat?.parentId ?? id;
}

/** 一筆紀錄在畫面上該用哪個圖示／顏色——子分類沿用它大分類的（「下午茶」就用「餐飲」
 *  那顆圖示跟顏色），子分類不需要各自設一組圖示，列表看起來也才有一致的色塊分群。
 *  分類已被刪除時回 undefined，呼叫端自己決定要顯示什麼。 */
export function displayCategoryOf(categories: CategoryDTO[], id: string): CategoryDTO | undefined {
  return categoryById(categories, topLevelCategoryId(categories, id));
}

/** 同一個父分類底下（頂層分類比對 kind，子分類比對 parentId）名稱不能重複——重複的話
 *  分類格子、下拉路徑都分不出是哪一個。excludeId 讓編輯既有分類時不會把自己當成跟
 *  自己撞名。 */
export function categoryNameTaken(
  categories: CategoryDTO[],
  name: string,
  scope: { kind: CategoryKind; parentId?: string },
  excludeId?: string,
): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  return categories.some(
    (c) =>
      c.id !== excludeId &&
      c.kind === scope.kind &&
      (c.parentId ?? undefined) === scope.parentId &&
      c.name.trim() === trimmed,
  );
}

export const categoryColorClass: Record<CategoryColor, string> = {
  a: "bg-cat-a-bg text-cat-a-fg",
  b: "bg-cat-b-bg text-cat-b-fg",
  c: "bg-cat-c-bg text-cat-c-fg",
  d: "bg-cat-d-bg text-cat-d-fg",
  e: "bg-cat-e-bg text-cat-e-fg",
  f: "bg-cat-f-bg text-cat-f-fg",
};

// Tailwind 要在原始碼看到完整字串才會產生對應 class，不能用字串拼接／replace 動態組出 bg-cat-a-fg
// 這種名稱，所以額外列一份「純色塊」版本給進度條這類只需要單色填滿的地方用。
export const categoryFillClass: Record<CategoryColor, string> = {
  a: "bg-cat-a-fg",
  b: "bg-cat-b-fg",
  c: "bg-cat-c-fg",
  d: "bg-cat-d-fg",
  e: "bg-cat-e-fg",
  f: "bg-cat-f-fg",
};

// SVG 圖表的 stroke/fill 需要真的顏色值，不能用 Tailwind class（class 只會在编译时被
// 掃進 CSS，SVG 屬性拿到的是一個字串，套不上 class）——這份是 globals.css 那組
// --cat-*-fg 的字面值複製一份，跟分類圖示徽章用的是同一組顏色，不是另外配的新色票。
export const categoryColorHex: Record<CategoryColor, string> = {
  a: "#A9A5FF",
  b: "#B2B950",
  c: "#F38CAF",
  d: "#79B4FF",
  e: "#D3AC41",
  f: "#22CBB9",
};
