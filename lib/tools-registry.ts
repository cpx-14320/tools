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
  /** 還沒有插畫、但在入口頁／登入頁想指定一個像樣的線條圖示時填 Font Awesome 的名字
   *  （不填就是通用的 `shapes`）。那兩頁的圖示一律走 Font Awesome、不用表情符號，
   *  理由見 components/ui.tsx 的 FaIcon。 */
  faIcon?: string;
  href: string;
}

export const TOOLS_REGISTRY: ToolMeta[] = [
  {
    toolId: "transit",
    name: "搭乘車查詢",
    description: "查固定通勤班次時刻表，誤點或即將到站時推播提醒。",
    icon: "🚌",
    iconImage: "/hub/transit.png",
    href: "/tools/transit",
  },
  {
    toolId: "expenses",
    name: "記帳本",
    description: "記下每一筆收支，月底回頭看看錢花在哪、目標存了多少。",
    icon: "💰",
    iconImage: "/hub/expenses.png",
    href: "/tools/expenses",
  },
  {
    toolId: "compress",
    name: "圖片壓縮",
    description: "把照片、截圖壓到夠小再存下來，圖片不會離開你的裝置。",
    icon: "🖼️",
    faIcon: "image",
    href: "/tools/compress",
  },
];
