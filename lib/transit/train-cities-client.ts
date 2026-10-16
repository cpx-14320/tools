"use client";

// 瀏覽器端專用：台鐵站名清單（約 240 站）的取得與快取。刻意不從 lib/transit/tdx-stations.ts
// 匯入任何東西——那個檔案會連到 TDX 金鑰跟 mongodb 驅動程式，絕不能進到 "use client" 的
// 打包範圍。
//
// 同一份清單有三個地方會用到：首頁（火車模式的出發／抵達站選單）、常用行程編輯彈窗、
// 搜尋結果頁「加入行程」（要反查站名屬於哪個縣市）。以前這三處各自 fetch 一次，而且
// 結果頁那邊還為了出發站、抵達站各查一次（Promise.all 兩個一樣的 URL ＝ 真的送出兩個
// 請求）。這裡在模組層級存同一個 promise，整個分頁生命週期內只會真的發一次請求；配合
// /api/transit/tra/stations 回應的 Cache-Control，重新整理後也直接命中瀏覽器快取。

export interface TrainStationCities {
  /** 縣市 → 站名清單，給「選縣市→選站」兩層選單直接用。 */
  byCity: Record<string, string[]>;
}

let pending: Promise<TrainStationCities> | null = null;

export function fetchTrainStationCities(): Promise<TrainStationCities> {
  if (pending) return pending;
  pending = fetch("/api/transit/tra/stations")
    .then((res) => res.json())
    .then((data: { cities?: { city: string; stations: { name: string }[] }[] }) => {
      const byCity: Record<string, string[]> = {};
      for (const c of data.cities ?? []) byCity[c.city] = c.stations.map((s) => s.name);
      return { byCity };
    })
    .catch((err) => {
      // 失敗不要留著快取，不然這個分頁接下來永遠拿到同一個失敗的 promise。
      pending = null;
      throw err;
    });
  return pending;
}

/** 這個站名屬於哪個縣市；查不到回 undefined，由呼叫端決定要怎麼退回。 */
export async function resolveTrainStationCity(stationName: string): Promise<string | undefined> {
  const { byCity } = await fetchTrainStationCities();
  return Object.keys(byCity).find((city) => byCity[city].includes(stationName));
}
