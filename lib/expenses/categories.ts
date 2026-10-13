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
  /** 每月預算，只對頂層「支出」分類有意義——子分類跟收入分類沒有自己的預算，花費算進
   *  它們的頂層大分類裡一起比對。沒填代表這個分類沒設預算。 */
  budgetAmount?: number;
}

export interface DefaultCategorySeed {
  name: string;
  icon: string;
  color: CategoryColor;
  kind: CategoryKind;
}

/** 新帳號分類清單是空的，要一個個手動建最麻煩——這份清單讓使用者一鍵套用常見分類，
 *  套用時會跳過名稱已存在的項目（見 categories-view.tsx），不會建出重複分類。 */
export const DEFAULT_CATEGORIES: DefaultCategorySeed[] = [
  { name: "餐飲", icon: "🍚", color: "a", kind: "支出" },
  { name: "交通", icon: "🚗", color: "b", kind: "支出" },
  { name: "購物", icon: "🛍️", color: "c", kind: "支出" },
  { name: "居家", icon: "🏠", color: "d", kind: "支出" },
  { name: "水電瓦斯", icon: "💡", color: "e", kind: "支出" },
  { name: "醫療", icon: "🏥", color: "f", kind: "支出" },
  { name: "娛樂", icon: "🎮", color: "a", kind: "支出" },
  { name: "其他", icon: "📦", color: "b", kind: "支出" },
  { name: "薪資", icon: "💰", color: "c", kind: "收入" },
  { name: "獎金", icon: "🎁", color: "d", kind: "收入" },
  { name: "投資", icon: "📈", color: "e", kind: "收入" },
  { name: "其他收入", icon: "➕", color: "f", kind: "收入" },
];

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
