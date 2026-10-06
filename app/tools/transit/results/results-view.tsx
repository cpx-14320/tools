"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FaIcon } from "@/components/dream/fa-icon";
import { scrollContainerToTop, scrollWithin } from "@/lib/scroll-within";
import { STATIONS_BY_CITY, FALLBACK_TRAIN_STATIONS_BY_CITY } from "@/components/dream/stations-data";
import { TripGroupPickerModal } from "@/components/dream/trip-group-picker-modal";
import { FREQUENT_TRIP_ICON_OPTIONS } from "@/components/dream/frequent-trip-icons";
import type { FrequentTripDraft } from "@/components/dream/frequent-trip-modal";
import { metroSystemOf, findCrossSystemTransferStation } from "@/lib/metro-lines";
import { formatDuration, todayInTaipei, nowHHmmInTaipei } from "@/lib/tdx-time";
import { routeBadgeStyle, etaLabel, etaToneStyle } from "@/components/dream/bus-route-picker-modal";

export type Mode = "bus" | "train" | "metro" | "thsr";

// TDX 回傳的車種名稱其實很雜（自強號依車型/有無自行車車廂細分成好幾種寫法，例如
// 「自強(3000)(EMU3000 型電車) 161 次」「自強(推拉式自強號且有自行車車廂) ...」，雖然
// API 那邊已經先簡化過一次，這裡還是用「開頭是不是這個車種」判斷比較保險）。
// 比對順序跟頁籤顯示順序是分開的兩件事：「區間快」比對時要排在「區間」前面，不然
// 「區間快 2005 次」會先被「區間」這個較短的前綴誤判掉；頁籤顯示順序則照使用者指定的
// 全部／區間／區間快／自強／普悠瑪。沒列在這裡的車種（例如莒光、太魯閣）不會從列表
// 消失，只是不會歸進任何一個特定分類頁籤，只能在「全部」看到。
const TRAIN_TYPE_MATCH_ORDER = ["自強", "普悠瑪", "區間快", "區間"];
const TRAIN_TYPE_TABS = ["全部", "區間", "區間快", "自強", "普悠瑪"];

function trainTypeOf(code: string): string {
  return TRAIN_TYPE_MATCH_ORDER.find((prefix) => code.startsWith(prefix)) ?? code.split(" ")[0] ?? code;
}

function trainNumberOf(code: string): string {
  return code.match(/\d+/)?.[0] ?? code;
}

// 火車不分車種（自強／莒光／區間...），車次號統一用這個樣式，不再逐車種配色。
const TRAIN_BADGE_STYLE = "bg-[#EDEAFC] text-[#8477C2]";

const MODE_STYLE: Record<Mode, string> = {
  train: TRAIN_BADGE_STYLE,
  thsr: "bg-[#F3E8FC] text-[#9A5FD6]",
  bus: "bg-[#E3F6EC] text-[#2FAE82]",
  metro: "bg-[#E6EEFC] text-[#4E7FE0]",
};

function badgeClass(mode: Mode) {
  return MODE_STYLE[mode];
}

// 加入行程分類時，常用行程的站點欄位要存對應的縣市（跟首頁的出發／抵達站選擇器同一套
// 資料），不然之後打開分類編輯彈窗時，站名的縣市下拉會對不起來。公車／高鐵／捷運用
// 現成的靜態縣市清單找；火車站名有 ~240 個、不在靜態墊檔清單裡，查一次 TDX 真實站名清單。
async function resolveCityFor(mode: Mode, stationName: string): Promise<string> {
  if (mode === "train") {
    try {
      const res = await fetch("/api/transit/tra/stations");
      const data: { cities?: { city: string; stations: { name: string }[] }[] } = await res.json();
      const found = data.cities?.find((c) => c.stations.some((s) => s.name === stationName));
      if (found) return found.city;
    } catch {
      // 查不到就退回墊檔清單的第一個縣市，使用者之後打開分類編輯彈窗自己校正站名即可。
    }
    return Object.keys(FALLBACK_TRAIN_STATIONS_BY_CITY)[0];
  }
  const cities = STATIONS_BY_CITY[mode];
  const found = Object.keys(cities).find((c) => cities[c].includes(stationName));
  return found ?? Object.keys(cities)[0];
}

/** 捷運轉乘其中一段的明細，跟 lib/metro-routing.ts 的 TransferStep 同一個形狀——這個檔案
 *  是 "use client"，不能直接 import 那邊（會把伺服器端的 TDX 金鑰牽連進前端 bundle），
 *  所以在這裡另外宣告一份一樣的形狀，不是真的共用同一個型別。 */
interface TransferStep {
  stationName: string;
  lineNo?: string;
  lineColor?: string;
}

interface ResultRow {
  time: string;
  arrive: string;
  code: string;
  duration: string;
  stops: number;
  fare?: string;
  /** 只有高鐵會用到：早鳥票折扣（例如「6.5折」），查得到才會有值。 */
  earlyBirdDiscount?: string;
  operatingNote?: string;
  delayMinutes?: number;
  isPast?: boolean;
  /** 只有捷運會用到：中途要不要轉乘、每一段轉乘的明細（查得到的話）。 */
  transfer?: boolean;
  transferSteps?: TransferStep[];
}

// 捷運從早上 6 點營運到半夜 12 點，班距用 8 分鐘一班的平均值墊著（沒有細分尖峰／離峰，
// 真正的班距之後接真資料時才會準）——至少不管搜尋時間是幾點，都能看到從那個時間點往後
// 一整天合理數量的班次，不會像以前固定只給 6 點多那 5 筆、查別的時間就什麼都看不到。
// 用「從午夜算起的分鐘數」當迴圈邊界，不要用時間字串比較——字串比較在跨過午夜那一圈會出
// 「00:04」這種開頭回到 0 的字串，字串序永遠小於 "24:00"，迴圈邊界會失效變成無窮迴圈。
const METRO_SERVICE_START_MIN = 6 * 60;
const METRO_SERVICE_END_MIN = 24 * 60;
const METRO_INTERVAL_MIN = 8;

function minutesToHHMM(totalMinutes: number): string {
  const wrapped = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  return minutesToHHMM(h * 60 + m + minutes);
}

function generateMetroRows(date: string, lineCode: string, trip: MetroTripInfo | null): ResultRow[] {
  // trip 還是 null 代表真實資料（車程時間／站數／票價／轉乘）還沒查回來，不能先用假的
  // 預設值（車程 40 分、12 站…）產生一整天的班次，不然使用者會先看到這組錯的資料，
  // 等 API 回來又整批跳成正確的、等於閃一下——這裡改成直接回傳空陣列，讓外層的
  // loading 狀態接手顯示「查詢中…」，跟火車／高鐵／公車同一套做法。
  if (!trip) return [];

  const today = todayInTaipei();
  // 從「我的行程」常用行程卡片點「搜尋班次」進來時網址不會帶 date 參數（見 page.tsx），
  // date 會是空字串；空字串在字串比較裡永遠小於任何日期字串，下面的 isPast 判斷會整批
  // 誤判成「已經過期」，所有班次卡片都灰掉——火車／高鐵是在各自的 API route 那邊用
  // `date || today` 擋掉同樣的狀況，捷運這裡是純前端算的，要自己補這個預設值。
  const effectiveDate = date || today;
  const nowTime = nowHHmmInTaipei();
  const rows: ResultRow[] = [];
  for (let totalMin = METRO_SERVICE_START_MIN; totalMin < METRO_SERVICE_END_MIN; totalMin += METRO_INTERVAL_MIN) {
    const t = minutesToHHMM(totalMin);
    rows.push({
      time: t,
      arrive: addMinutes(t, trip.durationMin),
      code: lineCode,
      duration: formatDuration(trip.durationMin),
      stops: trip.stops,
      fare: trip.fare !== undefined ? `NT$ ${trip.fare}` : "—",
      transfer: trip.transfer,
      transferSteps: trip.transferSteps,
      isPast: effectiveDate < today || (effectiveDate === today && t < nowTime),
    });
  }
  return rows;
}

// 站名格式是「路線代碼＋站碼」接著站名（例如「BL07板橋」「A1台北車站」），開頭那段
// 字母就是路線代碼，用來當捷運假資料的車次代碼——至少會跟使用者實際選的出發站對得上，
// 不會不管選哪個系統都顯示同一條線。
function metroLineCodeOf(station: string): string {
  return station.match(/^[A-Za-z]+/)?.[0] ?? "";
}

interface MetroTripInfo {
  durationMin: number;
  stops: number;
  fare?: number;
  transfer: boolean;
  transferSteps?: TransferStep[];
}

// 捷運車程時間／停靠站數／票價改成查真實資料（lib/metro-routing.ts），不是固定的墊檔數字
// ——同系統內打 /api/transit/metro/trip 用 TDX 真實站間行車時間＋票價表算；出發／抵達是
// 跨系統（只有台北／新北／桃園機場捷運互通那三個會發生）沒有統一的票價／行車時間資料，
// 只能先用合理的估計值墊著，但轉乘站名是真的比對兩個系統的站名清單查出來的，不是亂猜。
function useMetroTrip(mode: Mode, origin: string, dest: string): MetroTripInfo | null {
  const [trip, setTrip] = useState<MetroTripInfo | null>(null);

  useEffect(() => {
    if (mode !== "metro" || !origin || !dest) return;
    const originSystem = metroSystemOf(origin);
    const destSystem = metroSystemOf(dest);
    if (!originSystem || !destSystem) return;

    if (originSystem !== destSystem) {
      // 跨系統沒有統一的站間行車時間資料查不出「轉乘之後要搭哪條線」，轉乘提示只能先
      // 顯示到站名這一層，不像同系統那樣能附上線別代碼標籤。
      const transferStation = findCrossSystemTransferStation(originSystem, destSystem);
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setTrip({
        durationMin: 40,
        stops: 12,
        fare: 30,
        transfer: true,
        transferSteps: transferStation ? [{ stationName: transferStation }] : undefined,
      });
      return;
    }

    let cancelled = false;
    setTrip(null);
    const qs = new URLSearchParams({ system: originSystem, origin, dest });
    fetch(`/api/transit/metro/trip?${qs.toString()}`)
      .then((res) => res.json())
      .then((data: { trip?: MetroTripInfo }) => {
        if (!cancelled && data.trip) setTrip(data.trip);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mode, origin, dest]);

  return trip;
}

// 公車是「路線優先」（見 components/dream/bus-route-picker-modal.tsx），結果頁拿到的是
// 選好的縣市＋路線＋方向＋站牌，不是起訖站——查的是這條路線＋這個方向的完整真實站序，
// 每一站都帶即時到站狀態（lib/bus-routing.ts），不是像火車／高鐵／捷運那樣查「一整天的
// 班次清單」：公車沒有時刻表，只能查「現在」。
type BusEtaStatus = "ok" | "arriving" | "notStarted" | "pastLast" | "unavailable";

interface BusStopEta {
  name: string;
  status: BusEtaStatus;
  etaMinutes: number | null;
}

function useBusRouteStops(mode: Mode, city: string, route: string, direction: 0 | 1) {
  const [stops, setStops] = useState<BusStopEta[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "bus" || !city || !route) return;
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect */
    setStops(null);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    const qs = new URLSearchParams({ city, route, direction: String(direction) });
    fetch(`/api/transit/bus/route-stops?${qs.toString()}`)
      .then((res) => res.json())
      .then((data: { stops?: BusStopEta[]; error?: string }) => {
        if (cancelled) return;
        if (data.error) setError(data.error);
        setStops(data.stops ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("公車站序查詢失敗，請稍後再試");
      });
    return () => {
      cancelled = true;
    };
  }, [mode, city, route, direction]);

  return { stops, error };
}

interface TraRow {
  time: string;
  arrive: string;
  code: string;
  duration: string;
  stops: number;
  fare?: string;
  operatingNote?: string;
  delayMinutes?: number;
  isPast: boolean;
}

// 火車改成真的打台鐵 OD 時刻表 API，查詢中或失敗時分別用 loading/錯誤訊息呈現，不再用假資料墊著。
function useTrainResults(mode: Mode, origin: string, dest: string, date: string, time: string) {
  const [rows, setRows] = useState<TraRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 不是火車模式就不用打台鐵的 API——這個 hook 之前沒檢查 mode，每次搜尋都會打台鐵
    // API，捷運／公車／高鐵查出來的站名對台鐵站碼表當然查不到，錯誤訊息（「沒有台鐵站碼
    // 對照」）跟著就會透過 queryError 顯示在別的車種頁面上，是完全不相關的雜訊。
    if (mode !== "train") return;
    let cancelled = false;
    // origin/dest/date/time 一變就要重新查詢，故意同步把上一次的結果清掉讓畫面回到
    // 查詢中狀態，不是在訂閱外部事件、也不會連鎖觸發其他 effect，屬於這個規則容許的例外。
    /* eslint-disable react-hooks/set-state-in-effect */
    setRows(null);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    const qs = new URLSearchParams({ origin, dest });
    if (date) qs.set("date", date);
    if (time) qs.set("time", time);
    fetch(`/api/transit/tra/od-timetable?${qs.toString()}`)
      .then((res) => res.json())
      .then((data: { rows?: TraRow[]; error?: string }) => {
        if (cancelled) return;
        if (data.error) setError(data.error);
        setRows(data.rows ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("台鐵班次查詢失敗，請稍後再試");
      });
    return () => {
      cancelled = true;
    };
  }, [mode, origin, dest, date, time]);

  return { rows, error };
}

interface ThsrRow {
  time: string;
  arrive: string;
  code: string;
  duration: string;
  stops: number;
  fare?: string;
  earlyBirdDiscount?: string;
  isPast: boolean;
}

// 高鐵改成真的打 TDX 的每日時刻表＋票價表，不再用固定 5 筆假資料——跟火車同一套做法
// （useTrainResults），只是高鐵的票價是查到就直接用全票價字串，不用額外算車種對應表
// （高鐵只有一種車種，不像台鐵自強／區間要分開查）。
function useThsrResults(mode: Mode, origin: string, dest: string, date: string, time: string) {
  const [rows, setRows] = useState<ThsrRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 同 useTrainResults：不是高鐵模式就不用打高鐵的 API。
    if (mode !== "thsr") return;
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect */
    setRows(null);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    const qs = new URLSearchParams({ origin, dest });
    if (date) qs.set("date", date);
    if (time) qs.set("time", time);
    fetch(`/api/transit/thsr/timetable?${qs.toString()}`)
      .then((res) => res.json())
      .then((data: { rows?: ThsrRow[]; error?: string }) => {
        if (cancelled) return;
        if (data.error) setError(data.error);
        setRows(data.rows ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("高鐵班次查詢失敗，請稍後再試");
      });
    return () => {
      cancelled = true;
    };
  }, [mode, origin, dest, date, time]);

  return { rows, error };
}

export function ResultsView({
  origin,
  dest,
  mode,
  date,
  time,
  startTime = "",
  endTime = "",
  busCity = "",
  busRoute = "",
  busDirection = 0,
  busStop = "",
}: {
  origin: string;
  dest: string;
  mode: Mode;
  date: string;
  time: string;
  /** 從「我的行程」常用行程卡片的時段區間帶進來才會有值——有值時只顯示這個時間區間內
   *  的班次，不是全部都顯示；首頁搜尋只有單一出發時間，不會帶這兩個參數，所以還是維持
   *  顯示全部結果（只用卡片本身的 isPast 狀態去標示是否已經過期），不受這段邏輯影響。 */
  startTime?: string;
  endTime?: string;
  /** 只有公車會用到：選好的縣市／路線／方向／站牌（見 bus-route-picker-modal.tsx），
   *  公車不是起訖站模式，不用上面的 origin/dest。 */
  busCity?: string;
  busRoute?: string;
  busDirection?: 0 | 1;
  busStop?: string;
}) {
  const isTrain = mode === "train";
  const isMetro = mode === "metro";
  const isThsr = mode === "thsr";
  const isBus = mode === "bus";
  const { rows: trainRows, error: trainError } = useTrainResults(mode, origin, dest, date, time);
  const { rows: thsrRows, error: thsrError } = useThsrResults(mode, origin, dest, date, time);
  const { stops: busStops, error: busError } = useBusRouteStops(mode, busCity, busRoute, busDirection);
  const metroTrip = useMetroTrip(mode, origin, dest);
  const allResults: ResultRow[] = isTrain
    ? trainRows ?? []
    : isThsr
      ? thsrRows ?? []
      : isMetro
        ? generateMetroRows(date, metroLineCodeOf(origin), metroTrip)
        : [];
  const results = startTime && endTime ? allResults.filter((r) => r.time >= startTime && r.time <= endTime) : allResults;
  const loading =
    (isTrain && trainRows === null && !trainError) ||
    (isThsr && thsrRows === null && !thsrError) ||
    (isBus && busStops === null && !busError) ||
    (isMetro && metroTrip === null);
  const queryError = trainError || thsrError || busError;
  const [typeTab, setTypeTab] = useState("全部");
  const visibleResults = isTrain && typeTab !== "全部" ? results.filter((r) => trainTypeOf(r.code) === typeTab) : results;
  // 點班次卡片右邊的「加入行程」時記住是哪一筆，選好分類（或新增分類）後才知道要用
  // 哪一筆的時間／站名組出常用行程的資料。公車不是逐筆班次、是單一路線＋方向＋站牌的
  // 選擇，另外用 busAddOpen 這個布林值開同一顆 TripGroupPickerModal。
  const [pickerTarget, setPickerTarget] = useState<ResultRow | null>(null);
  const [busAddOpen, setBusAddOpen] = useState(false);

  async function addPickerTargetToGroup(groupId: string) {
    const target = pickerTarget;
    if (!target) return;
    setPickerTarget(null);
    const [originCity, destCity] = await Promise.all([resolveCityFor(mode, origin), resolveCityFor(mode, dest)]);
    const existing: FrequentTripDraft[] = await fetch("/api/transit/frequent-trips")
      .then((res) => res.json())
      .then((data: { trips?: (FrequentTripDraft & { groupId: string })[] }) => (data.trips ?? []).filter((t) => t.groupId === groupId))
      .catch(() => []);
    const newItem: FrequentTripDraft = {
      icon: FREQUENT_TRIP_ICON_OPTIONS[0].key,
      originCity,
      origin,
      destCity,
      dest,
      startTime: target.time,
      endTime: target.arrive,
    };
    await fetch("/api/transit/frequent-trips", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, groupId, items: [...existing, newItem] }),
    }).catch(() => {});
  }

  async function createGroupAndAddPickerTarget(name: string) {
    const target = pickerTarget;
    if (!target) return;
    setPickerTarget(null);
    const createData: { group?: { id: string } } = await fetch("/api/transit/trip-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, name }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (!createData.group) return;
    const [originCity, destCity] = await Promise.all([resolveCityFor(mode, origin), resolveCityFor(mode, dest)]);
    const newItem: FrequentTripDraft = {
      icon: FREQUENT_TRIP_ICON_OPTIONS[0].key,
      originCity,
      origin,
      destCity,
      dest,
      startTime: target.time,
      endTime: target.arrive,
    };
    await fetch("/api/transit/frequent-trips", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, groupId: createData.group.id, items: [newItem] }),
    }).catch(() => {});
  }

  // 公車把目前選好的縣市／路線／方向／站牌整組加入分類（不是逐筆班次），時段先給預設值，
  // 使用者之後可以在「我的行程」編輯彈窗自己改——跟台鐵/高鐵/捷運那兩個函式的差異只在
  // FrequentTripDraft 要填的欄位形狀不同（見 lib/frequent-trips.ts 的欄位註解）。
  function busDraft(): FrequentTripDraft {
    return {
      icon: FREQUENT_TRIP_ICON_OPTIONS[0].key,
      originCity: busCity,
      origin: busRoute,
      destCity: "",
      dest: busStop,
      busDirection,
      startTime: "08:00",
      endTime: "09:00",
    };
  }

  async function addBusToGroup(groupId: string) {
    setBusAddOpen(false);
    const existing: FrequentTripDraft[] = await fetch("/api/transit/frequent-trips")
      .then((res) => res.json())
      .then((data: { trips?: (FrequentTripDraft & { groupId: string })[] }) => (data.trips ?? []).filter((t) => t.groupId === groupId))
      .catch(() => []);
    await fetch("/api/transit/frequent-trips", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, groupId, items: [...existing, busDraft()] }),
    }).catch(() => {});
  }

  async function createGroupAndAddBus(name: string) {
    setBusAddOpen(false);
    const createData: { group?: { id: string } } = await fetch("/api/transit/trip-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, name }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (!createData.group) return;
    await fetch("/api/transit/frequent-trips", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, groupId: createData.group.id, items: [busDraft()] }),
    }).catch(() => {});
  }

  // 錨點效果：列表一出現（或切換車種頁籤）就跳到「最後一筆已過站」的卡片，讓使用者一眼
  // 看到「剛好錯過的那班」再往下接著看還沒過站的班次，不用自己往下滑過一排已發車的班次。
  // 沒有任何一筆過站（第一筆就是還沒過站）或全部都過站了，都不特別捲動，留在最上面就好。
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    if (visibleResults.length === 0) return;
    const firstUpcoming = visibleResults.findIndex((r) => !r.isPast);
    const lastPastIndex = firstUpcoming > 0 ? firstUpcoming - 1 : -1;
    const target = lastPastIndex >= 0 ? cardRefs.current[lastPastIndex] : null;
    if (target) scrollWithin(target, "start");
  }, [visibleResults]);

  return (
    <div className="flex flex-col">
      {/* 起訖站標題跟分類頁籤 sticky 固定在頂端——列表資料一多，使用者切換頁籤或想看
          共幾筆班次時不用先滑回最上面。sticky 是相對這個可捲動區域本身，不像 fixed
          需要額外處理寬螢幕手機外框卡片置中的問題。背景要蓋住，不然捲動時後面的卡片
          會透出來。 */}
      <div className="sticky top-0 z-10 bg-[#F3EFFC] px-5 pb-4 pt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            {isBus ? (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${routeBadgeStyle(busRoute)}`}>{busRoute}</span>
                <span className="text-xs text-[#9C94C4]">{busDirection === 1 ? "返程" : "去程"}</span>
                <span className="truncate text-base font-bold text-[#4A3B7C]">{busStop}</span>
              </p>
            ) : (
              <p className="flex items-center gap-3 truncate">
                <span className="text-base font-bold text-[#4A3B7C]">
                  {origin} <span aria-hidden>→</span> {dest}
                </span>
                <span className="truncate text-xs text-[#B3ABD4]">{loading ? "查詢中…" : `共 ${visibleResults.length} 筆班次`}</span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isBus && (
              <button
                type="button"
                onClick={() => setBusAddOpen(true)}
                aria-label="加入行程"
                className="grid size-8 place-items-center rounded-full bg-white text-sm font-bold leading-none text-[#6F5FD6]"
              >
                ＋
              </button>
            )}
            <Link
              href="/tools/transit"
              aria-label="返回首頁"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-[#6F5FD6]"
            >
              <FaIcon icon="arrow-left" size={16} />
            </Link>
          </div>
        </div>

        {isTrain && (
          <div className="-mx-5 mt-4 overflow-x-auto px-5">
            <div className="inline-flex items-center gap-1 rounded-full bg-white p-1">
              {TRAIN_TYPE_TABS.map((t) => {
                const active = typeTab === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeTab(t)}
                    className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                      active ? "bg-[#6F5FD6] text-white shadow-[0_2px_8px_-2px_rgba(111,95,214,0.4)]" : "text-[#9C94C4]"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {queryError && <p className="mx-5 mt-4 rounded-2xl bg-[#FDEEF0] px-4 py-3 text-xs text-[#D1517E]">{queryError}</p>}

      {!isBus && !loading && !queryError && visibleResults.length === 0 && (
        <p className="mx-5 mt-6 text-left text-xs text-[#B3ABD4]">目前沒有查到任何班次。</p>
      )}

      {isBus && !loading && !queryError && (busStops?.length ?? 0) === 0 && (
        <p className="mx-5 mt-6 text-left text-xs text-[#B3ABD4]">目前查不到這條路線這個方向的站序資料。</p>
      )}

      {isBus && (
        <div className="mt-4 flex flex-col gap-2.5 px-5 pb-6">
          {(busStops ?? []).map((s) => (
            <div
              key={s.name}
              className={`flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-[0_6px_20px_-8px_rgba(111,95,214,0.25)] ${
                s.name === busStop ? "ring-2 ring-[#6F5FD6]" : ""
              }`}
            >
              <span className="truncate text-sm font-medium text-[#4A3B7C]">{s.name}</span>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${etaToneStyle(s)}`}>{etaLabel(s)}</span>
            </div>
          ))}
        </div>
      )}

      {!isBus && (
      <div className="mt-4 flex flex-col gap-2.5 px-5 pb-6">
        {visibleResults.map((r, i) => (
          <div
            key={i}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            className={`rounded-[1.5rem] bg-white p-4 shadow-[0_6px_20px_-8px_rgba(111,95,214,0.25)] ${r.isPast ? "opacity-50" : ""}`}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#4A3B7C]">
                  {r.time} <span aria-hidden>→</span> {r.arrive}
                </p>
                {/* 高鐵下方格線本來就有「車程時間」那一欄，這裡不用重複顯示一次；捷運如果
                    需要轉乘，這裡改顯示轉乘明細（哪一站、轉哪條線），車程時間一樣看下面
                    格線那欄就好，不用在這裡重複、也不用犧牲轉乘資訊的版面。 */}
                {!isThsr &&
                  (isMetro && r.transfer && r.transferSteps && r.transferSteps.length > 0 ? (
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-[#9C94C4]">
                      {r.transferSteps.map((step, idx, arr) => (
                        <span key={idx} className="inline-flex items-center gap-1">
                          於{step.stationName}轉乘
                          {step.lineNo && (
                            <span
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                              style={{ backgroundColor: step.lineColor ? `${step.lineColor}1F` : "#E6EEFC", color: step.lineColor ?? "#4E7FE0" }}
                            >
                              {step.lineNo}
                            </span>
                          )}
                          {idx < arr.length - 1 && "、"}
                        </span>
                      ))}
                    </p>
                  ) : (
                    <p className="mt-0.5 truncate text-xs text-[#9C94C4]">{isTrain && r.operatingNote ? r.operatingNote : r.duration}</p>
                  ))}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {r.delayMinutes !== undefined ? (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      r.delayMinutes > 0 ? "bg-[#FDE7D8] text-[#D97A3D]" : "bg-[#E3F6EC] text-[#2FAE82]"
                    }`}
                  >
                    {r.delayMinutes > 0 ? `誤點 ${r.delayMinutes} 分` : "準時"}
                  </span>
                ) : null}
                <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badgeClass(mode)}`}>
                  {isTrain ? trainNumberOf(r.code) : r.code}
                </span>
                {/* 用「加入」而不是收藏愛心：單純是一次性加入分類的動作，不是可切換的收藏
                    狀態，不用額外判斷、呈現「是否已收藏」。 */}
                <button
                  type="button"
                  onClick={() => setPickerTarget(r)}
                  aria-label="加入行程"
                  className="grid size-6 shrink-0 place-items-center rounded-full bg-[#F3EFFC] text-sm font-bold leading-none text-[#6F5FD6]"
                >
                  ＋
                </button>
              </div>
            </div>

            <div
              className={`mt-3 grid gap-2 border-t border-[#F2EEFA] pt-3 text-xs text-center ${
                isThsr && r.earlyBirdDiscount ? "grid-cols-4" : isTrain || isMetro || isThsr ? "grid-cols-3" : "grid-cols-2"
              }`}
            >
              <div>
                <p className="text-[#B3ABD4]">車程時間</p>
                <p className="mt-0.5 font-medium text-[#4A3B7C]">{r.duration}</p>
              </div>
              <div>
                <p className="text-[#B3ABD4]">停靠站數</p>
                <p className="mt-0.5 font-medium text-[#4A3B7C]">{r.stops} 站</p>
              </div>
              {(isTrain || isMetro || isThsr) && (
                <div>
                  <p className="text-[#B3ABD4]">全票</p>
                  <p className="mt-0.5 font-medium text-[#4A3B7C]">{r.fare ?? "—"}</p>
                </div>
              )}
              {isThsr && r.earlyBirdDiscount && (
                <div>
                  <p className="text-[#B3ABD4]">早鳥</p>
                  <p className="mt-0.5 font-medium text-[#4A3B7C]">{r.earlyBirdDiscount}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      )}

      {(visibleResults.length > 0 || (isBus && (busStops?.length ?? 0) > 0)) && (
        // DreamMobileShell 的卡片容器本身有 transform，是這個 fixed 按鈕的定位基準
        // （不是整個瀏覽器視窗），right-5／bottom 直接貼齊卡片邊界，不用再額外包一層
        // mx-auto + max-w-[430px] 去手動對齊寬度。
        <button
          type="button"
          onClick={() => {
            const main = document.querySelector("main");
            if (main) scrollContainerToTop(main, "smooth");
          }}
          aria-label="回到頂部"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)", background: "linear-gradient(90deg, #8A7CEE, #6F5FD6)" }}
          className="fixed right-5 z-20 grid size-11 place-items-center rounded-full shadow-[0_8px_20px_-6px_rgba(111,95,214,0.6)] transition-opacity hover:opacity-90"
        >
          <FaIcon icon="arrow-up" size={18} className="text-white" />
        </button>
      )}

      <TripGroupPickerModal
        open={pickerTarget !== null || busAddOpen}
        mode={mode}
        onClose={() => {
          setPickerTarget(null);
          setBusAddOpen(false);
        }}
        onSelectGroup={isBus ? addBusToGroup : addPickerTargetToGroup}
        onCreateGroup={isBus ? createGroupAndAddBus : createGroupAndAddPickerTarget}
      />
    </div>
  );
}
