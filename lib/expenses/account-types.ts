// 純邏輯、不碰資料庫——CRUD 在同資料夾的 account-types.server.ts（見 categories.ts 開頭的說明）。
//
// 帳戶類型是「帳戶」的可自訂分類模板，跟消費分類 CategoryDTO 是同一套邏輯：圖示跟
// 資產/負債都是類型決定的，個別帳戶（accounts.ts）只負責自己的名稱跟期初餘額，不再
// 各自存一份圖示——理由跟分類／交易的關係一樣，避免兩邊資料兜不起來。

export type AccountKind = "asset" | "liability";

export interface AccountTypeDTO {
  id: string;
  name: string;
  icon: string;
  kind: AccountKind;
}

export interface DefaultAccountTypeSeed {
  name: string;
  icon: string;
  kind: AccountKind;
}

/** 比照 DEFAULT_CATEGORIES，讓使用者一鍵套用常見帳戶類型，不用從零一個個手動建。 */
export const DEFAULT_ACCOUNT_TYPES: DefaultAccountTypeSeed[] = [
  { name: "現金", icon: "💵", kind: "asset" },
  { name: "銀行帳戶", icon: "🏦", kind: "asset" },
  { name: "定存", icon: "🔒", kind: "asset" },
  { name: "股票", icon: "📈", kind: "asset" },
  { name: "基金", icon: "📊", kind: "asset" },
  { name: "加密貨幣", icon: "🪙", kind: "asset" },
  { name: "黃金", icon: "🥇", kind: "asset" },
  { name: "電子錢包", icon: "📱", kind: "asset" },
  { name: "不動產", icon: "🏠", kind: "asset" },
  { name: "信用卡", icon: "💳", kind: "liability" },
  { name: "貸款", icon: "📄", kind: "liability" },
  { name: "房貸", icon: "🏡", kind: "liability" },
];

export function accountTypesByKind(types: AccountTypeDTO[], kind: AccountKind): AccountTypeDTO[] {
  return types.filter((t) => t.kind === kind);
}

export function accountTypeById(types: AccountTypeDTO[], id: string): AccountTypeDTO | undefined {
  return types.find((t) => t.id === id);
}

/** 同一種資產/負債底下名稱不能重複——重複的話「資產配置」那種依名稱分組/上色的畫面
 *  會把兩個其實不同的類型顯示成同一塊，使用者看了會以為資料算錯。excludeId 讓編輯
 *  既有類型時不會把自己當成跟自己重複。 */
export function accountTypeNameTaken(types: AccountTypeDTO[], kind: AccountKind, name: string, excludeId?: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  return types.some((t) => t.kind === kind && t.id !== excludeId && t.name.trim() === trimmed);
}
