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
  /** 系統預設建立的類型——「清除全部資料」不會刪掉它們。 */
  isPreset?: boolean;
}

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
