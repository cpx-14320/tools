// 純邏輯、不碰資料庫——CRUD 在同資料夾的 salary-types.server.ts（見 categories.ts 開頭的說明）。

export type SalaryItemKind = "加項" | "扣項";

export interface SalaryItemTypeDTO {
  id: string;
  name: string;
  kind: SalaryItemKind;
}

export function salaryItemTypeById(types: SalaryItemTypeDTO[], id: string): SalaryItemTypeDTO | undefined {
  return types.find((t) => t.id === id);
}
