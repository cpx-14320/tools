// 靜態頁面階段的示範資料，欄位形狀對齊 PLANNING.html「搭乘車查詢」章節的資料模型
// （CommuteRoute／NotificationChannel），之後串 TDX API 跟資料庫時直接把這些函式換成真的查詢即可。
// LiveStatus／timetableFor 目前回傳固定假資料，模擬「輪詢 TDX 拿到的即時到站／誤點」與「時刻表查詢」結果。

export type Mode = "TRA" | "THSR" | "Bus" | "Metro";

export type Direction = "go" | "back";

export interface CommuteRoute {
  id: string;
  label: string;
  mode: Mode;
  originName: string;
  destName: string;
  /** 顯示用，依 mode 意義不同：台鐵／高鐵是車次號，公車是路線名稱，捷運是線別名稱。 */
  routeKey: string;
  /** 1=一…7=日，空陣列代表目前沒有啟用中的提醒日。 */
  activeWeekdays: number[];
  notifyBeforeMinutes: number;
  /** 只有台鐵／捷運有誤點資料可比對門檻；公車靠「預估到站秒數」本身判斷，不需要這個欄位。 */
  delayThresholdMinutes?: number;
  enabled: boolean;
  /** 啟程／返程：同一趟通勤的兩個方向，總覽頁一次只看其中一個方向。 */
  direction: Direction;
  /** 同一方向裡的第幾段（公車→火車→公車就是 1、2、3），總覽頁依此排序顯示。 */
  legOrder: number;
}

export interface NotificationChannel {
  provider: "telegram";
  chatId: string;
  enabled: boolean;
}

export interface TimetableRow {
  time: string;
  code: string; // 車次號／班次代碼
  destName: string;
  note?: string;
  delayMinutes?: number;
  /** 班次時間是否已經早於查詢的時間點（時刻表查詢頁的「時間」欄位，預設是現在）。 */
  isPast?: boolean;
}

export const modeMeta: Record<Mode, { label: string; icon: string; bg: string; fg: string }> = {
  TRA: { label: "台鐵", icon: "🚆", bg: "bg-cat-b-bg", fg: "text-cat-b-fg" },
  THSR: { label: "高鐵", icon: "🚄", bg: "bg-cat-c-bg", fg: "text-cat-c-fg" },
  Bus: { label: "公車", icon: "🚌", bg: "bg-cat-a-bg", fg: "text-cat-a-fg" },
  Metro: { label: "捷運", icon: "🚇", bg: "bg-cat-e-bg", fg: "text-cat-e-fg" },
};

// 示範資料對齊使用者實際的通勤型態：公車→火車→公車，啟程／返程各 3 段、站點互為反向。
export const commuteRoutes: CommuteRoute[] = [
  {
    id: "g1",
    label: "住家→中壢站",
    mode: "Bus",
    originName: "住家口",
    destName: "中壢火車站",
    routeKey: "桃園 5099",
    activeWeekdays: [1, 2, 3, 4, 5],
    notifyBeforeMinutes: 5,
    enabled: true,
    direction: "go",
    legOrder: 1,
  },
  {
    id: "g2",
    label: "中壢→台北",
    mode: "TRA",
    originName: "中壢",
    destName: "台北",
    routeKey: "區間快 2134 次",
    activeWeekdays: [1, 2, 3, 4, 5],
    notifyBeforeMinutes: 10,
    delayThresholdMinutes: 5,
    enabled: true,
    direction: "go",
    legOrder: 2,
  },
  {
    id: "g3",
    label: "台北→公司",
    mode: "Bus",
    originName: "台北車站",
    destName: "公司站",
    routeKey: "信義幹線",
    activeWeekdays: [1, 2, 3, 4, 5],
    notifyBeforeMinutes: 5,
    enabled: true,
    direction: "go",
    legOrder: 3,
  },
  {
    id: "b1",
    label: "公司→台北",
    mode: "Bus",
    originName: "公司站",
    destName: "台北車站",
    routeKey: "信義幹線",
    activeWeekdays: [1, 2, 3, 4, 5],
    notifyBeforeMinutes: 5,
    enabled: true,
    direction: "back",
    legOrder: 1,
  },
  {
    id: "b2",
    label: "台北→中壢",
    mode: "TRA",
    originName: "台北",
    destName: "中壢",
    routeKey: "區間快 2151 次",
    activeWeekdays: [1, 2, 3, 4, 5],
    notifyBeforeMinutes: 10,
    delayThresholdMinutes: 5,
    enabled: true,
    direction: "back",
    legOrder: 2,
  },
  {
    id: "b3",
    label: "中壢站→住家",
    mode: "Bus",
    originName: "中壢火車站",
    destName: "住家口",
    routeKey: "桃園 5099",
    activeWeekdays: [1, 2, 3, 4, 5],
    notifyBeforeMinutes: 5,
    enabled: true,
    direction: "back",
    legOrder: 3,
  },
];

// 總覽頁「重整」要一次顯示當下＋後面兩班，不是只秀一個狀態，所以這裡每個路線存 3 筆示範班次
// （公車用「預估 X 分」，台鐵帶車次跟誤點分鐘數），對齊時刻表頁的 TimetableRow 形狀方便共用渲染邏輯。
export const upcomingDepartures: Record<string, TimetableRow[]> = {
  g1: [
    { time: "預估 3 分", code: "桃園 5099", destName: "中壢火車站" },
    { time: "預估 15 分", code: "桃園 5099", destName: "中壢火車站" },
    { time: "預估 28 分", code: "桃園 5099", destName: "中壢火車站" },
  ],
  g2: [
    { time: "08:02", code: "區間快 2134 次", destName: "台北", delayMinutes: 4 },
    { time: "08:19", code: "區間 2136 次", destName: "台北", delayMinutes: 0 },
    { time: "08:30", code: "自強 1256 次", destName: "七堵", delayMinutes: 0 },
  ],
  g3: [
    { time: "預估 3 分", code: "信義幹線", destName: "往公司站" },
    { time: "預估 11 分", code: "信義幹線", destName: "往公司站" },
    { time: "預估 19 分", code: "信義幹線", destName: "往公司站" },
  ],
  b1: [
    { time: "預估 6 分", code: "信義幹線", destName: "往台北車站" },
    { time: "預估 14 分", code: "信義幹線", destName: "往台北車站" },
    { time: "預估 22 分", code: "信義幹線", destName: "往台北車站" },
  ],
  b2: [
    { time: "17:58", code: "區間快 2151 次", destName: "中壢", delayMinutes: 0 },
    { time: "18:15", code: "區間 2153 次", destName: "中壢", delayMinutes: 2 },
    { time: "18:32", code: "自強 1268 次", destName: "台中", delayMinutes: 0 },
  ],
  b3: [
    { time: "預估 4 分", code: "桃園 5099", destName: "往住家口" },
    { time: "預估 16 分", code: "桃園 5099", destName: "往住家口" },
    { time: "預估 29 分", code: "桃園 5099", destName: "往住家口" },
  ],
};

export function upcomingFor(routeId: string): TimetableRow[] {
  return upcomingDepartures[routeId] ?? [];
}

export const notificationChannel: NotificationChannel = {
  provider: "telegram",
  chatId: "615930182",
  enabled: true,
};

export function routeById(id: string): CommuteRoute | undefined {
  return commuteRoutes.find((r) => r.id === id);
}

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

/** 把 1~7 的啟用日陣列轉成「平日（一～五）」這種精簡顯示文字，常見組合給固定字樣，其他就逐天列出。 */
export function weekdayLabel(days: number[]): string {
  if (days.length === 0) return "尚未啟用提醒";
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return "平日（一～五）";
  if (days.length === 7) return "每天";
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LABELS[d - 1])
    .join("、");
}

/** 可查時刻表的站／路線選項，對應上面幾條通勤路線常用的出發點，示範用途先列這些就好。 */
export const timetableOptions: { mode: Mode; originName: string }[] = [
  { mode: "TRA", originName: "中壢" },
  { mode: "TRA", originName: "南港" },
  { mode: "THSR", originName: "台北" },
  { mode: "Bus", originName: "捷運象山站" },
  { mode: "Metro", originName: "古亭" },
];

const timetableData: Record<Mode, Record<string, TimetableRow[]>> = {
  TRA: {
    中壢: [
      { time: "07:58", code: "區間 2132 次", destName: "台北", delayMinutes: 0 },
      { time: "08:02", code: "區間快 2134 次", destName: "台北", delayMinutes: 4 },
      { time: "08:11", code: "自強 1256 次", destName: "七堵", delayMinutes: 0 },
      { time: "08:19", code: "區間 2136 次", destName: "台北", delayMinutes: 0 },
    ],
  },
  THSR: {
    台北: [
      { time: "08:30", code: "621 次", destName: "台中" },
      { time: "09:00", code: "625 次", destName: "台中" },
      { time: "09:30", code: "629 次", destName: "左營" },
    ],
  },
  Bus: {
    捷運象山站: [
      { time: "預估 3 分", code: "信義幹線", destName: "往松山車站", note: "車輛 603-FK" },
      { time: "預估 11 分", code: "信義幹線", destName: "往松山車站", note: "車輛 host-22" },
      { time: "預估 6 分", code: "台北 20", destName: "往南港", note: "車輛 889-TN" },
    ],
  },
  Metro: {
    古亭: [
      { time: "08:03", code: "松山新店線", destName: "往松山" },
      { time: "08:07", code: "松山新店線", destName: "往新店" },
      { time: "08:11", code: "中和新蘆線", destName: "往迴龍" },
    ],
  },
};

export function timetableFor(mode: Mode, originName: string): TimetableRow[] {
  return timetableData[mode]?.[originName] ?? [];
}
