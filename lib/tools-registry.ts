// 目前所有小工具的靜態清單——純資料，沒有任何伺服器端依賴，client component 也能直接
// 匯入使用（例如「其他小工具」區塊要依使用者權限清單過濾、連到其他工具）。
// lib/mongodb.ts 的 toolsRegistry seed 資料跟這裡要手動保持同步，新增工具時兩邊都要加。
export interface ToolMeta {
  toolId: string;
  name: string;
  description: string;
  icon: string;
  /** 真的有插畫圖示檔案時才填，沒有的工具先用上面的 emoji icon 墊著顯示。 */
  iconImage?: string;
  href: string;
}

export const TOOLS_REGISTRY: ToolMeta[] = [
  {
    toolId: "expenses",
    name: "記帳本",
    description: "計算每月薪水、記錄各類消費，可多人共用一個帳本。",
    icon: "📒",
    iconImage: "/icons/tools/expenses.png",
    href: "/tools/expenses",
  },
  { toolId: "transit", name: "搭乘車查詢", description: "查固定通勤班次時刻表，誤點或即將到站時推播提醒。", icon: "🚌", href: "/tools/transit" },
];
