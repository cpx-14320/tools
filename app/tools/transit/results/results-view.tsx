"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FaIcon } from "@/components/dream/fa-icon";
import { scrollContainerToTop, scrollWithin } from "@/lib/scroll-within";
import { STATIONS_BY_CITY, FALLBACK_TRAIN_STATIONS_BY_CITY } from "@/components/dream/stations-data";
import { TripGroupPickerModal } from "@/components/dream/trip-group-picker-modal";
import { FREQUENT_TRIP_ICON_OPTIONS } from "@/components/dream/frequent-trip-icons";
import type { FrequentTripDraft } from "@/components/dream/frequent-trip-modal";

export type Mode = "bus" | "train" | "metro" | "thsr";

const MODE_META: Record<Mode, { label: string }> = {
  train: { label: "火車" },
  thsr: { label: "高鐵" },
  bus: { label: "公車" },
  metro: { label: "捷運" },
};

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

interface ResultRow {
  time: string;
  arrive: string;
  code: string;
  duration: string;
  stops: number;
  price?: string;
  fare?: string;
  operatingNote?: string;
  delayMinutes?: number;
  isPast?: boolean;
}

// 公車／捷運／高鐵先用假資料墊著畫面，之後依序接上真實 API 時就會跟火車一樣換成 fetch 查詢。
const MOCK_RESULTS: Record<Exclude<Mode, "train">, ResultRow[]> = {
  thsr: [
    { time: "06:30", arrive: "08:06", code: "605", duration: "1 小時 36 分", stops: 4, price: "NT$ 1,490" },
    { time: "07:30", arrive: "09:00", code: "607", duration: "1 小時 30 分", stops: 3, price: "NT$ 1,490" },
    { time: "08:30", arrive: "10:12", code: "609", duration: "1 小時 42 分", stops: 5, price: "NT$ 1,490" },
    { time: "09:30", arrive: "11:00", code: "611", duration: "1 小時 30 分", stops: 3, price: "NT$ 1,490" },
    { time: "10:30", arrive: "12:06", code: "613", duration: "1 小時 36 分", stops: 4, price: "NT$ 1,490" },
  ],
  bus: [
    { time: "06:00", arrive: "07:10", code: "1861", duration: "1 小時 10 分", stops: 8, price: "NT$ 90" },
    { time: "07:00", arrive: "08:15", code: "1861", duration: "1 小時 15 分", stops: 8, price: "NT$ 90" },
    { time: "08:00", arrive: "09:05", code: "9005", duration: "1 小時 5 分", stops: 10, price: "NT$ 110" },
    { time: "09:00", arrive: "10:10", code: "1861", duration: "1 小時 10 分", stops: 8, price: "NT$ 90" },
    { time: "10:00", arrive: "11:05", code: "9005", duration: "1 小時 5 分", stops: 10, price: "NT$ 110" },
  ],
  metro: [
    { time: "06:05", arrive: "06:45", code: "淡水信義線", duration: "40 分", stops: 12, price: "NT$ 30" },
    { time: "06:15", arrive: "06:55", code: "淡水信義線", duration: "40 分", stops: 12, price: "NT$ 30" },
    { time: "06:25", arrive: "07:05", code: "淡水信義線", duration: "40 分", stops: 12, price: "NT$ 30" },
    { time: "06:35", arrive: "07:15", code: "淡水信義線", duration: "40 分", stops: 12, price: "NT$ 30" },
    { time: "06:45", arrive: "07:25", code: "淡水信義線", duration: "40 分", stops: 12, price: "NT$ 30" },
  ],
};

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
function useTrainResults(origin: string, dest: string, date: string, time: string) {
  const [rows, setRows] = useState<TraRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [origin, dest, date, time]);

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
}) {
  const meta = MODE_META[mode];
  const isTrain = mode === "train";
  const { rows: trainRows, error: trainError } = useTrainResults(origin, dest, date, time);
  const allResults: ResultRow[] = isTrain ? trainRows ?? [] : MOCK_RESULTS[mode];
  const results = startTime && endTime ? allResults.filter((r) => r.time >= startTime && r.time <= endTime) : allResults;
  const loading = isTrain && trainRows === null && !trainError;
  const [typeTab, setTypeTab] = useState("全部");
  const visibleResults = isTrain && typeTab !== "全部" ? results.filter((r) => trainTypeOf(r.code) === typeTab) : results;
  // 點班次卡片右邊的「加入行程」時記住是哪一筆，選好分類（或新增分類）後才知道要用
  // 哪一筆的時間／站名組出常用行程的資料。
  const [pickerTarget, setPickerTarget] = useState<ResultRow | null>(null);

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
            <p className="flex items-center gap-3 truncate">
              <span className="text-base font-bold text-[#4A3B7C]">
                {origin} <span aria-hidden>→</span> {dest}
              </span>
              <span className="truncate text-xs text-[#B3ABD4]">
                {meta.label}・
                {isTrain ? (loading ? "查詢中…" : `共 ${visibleResults.length} 筆班次`) : `共 ${results.length} 筆班次・之後會接真的即時資料`}
              </span>
            </p>
          </div>
          <Link
            href="/tools/transit"
            aria-label="返回首頁"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-[#6F5FD6]"
          >
            <FaIcon icon="arrow-left" size={16} />
          </Link>
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

      {isTrain && trainError && <p className="mx-5 mt-4 rounded-2xl bg-[#FDEEF0] px-4 py-3 text-xs text-[#D1517E]">{trainError}</p>}

      {!loading && !trainError && visibleResults.length === 0 && (
        <p className="mx-5 mt-6 text-left text-xs text-[#B3ABD4]">目前沒有查到任何班次。</p>
      )}

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
                <p className="mt-0.5 truncate text-xs text-[#9C94C4]">{isTrain && r.operatingNote ? r.operatingNote : r.duration}</p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {r.price ? (
                  <span className="rounded-full bg-[#F3EFFC] px-2.5 py-0.5 text-[11px] font-semibold text-[#6F5FD6]">{r.price}</span>
                ) : r.delayMinutes !== undefined ? (
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
                  {mode === "bus" ? " 路" : ""}
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

            <div className={`mt-3 grid gap-2 border-t border-[#F2EEFA] pt-3 text-xs text-center ${isTrain ? "grid-cols-3" : "grid-cols-2"}`}>
              <div>
                <p className="text-[#B3ABD4]">車程時間</p>
                <p className="mt-0.5 font-medium text-[#4A3B7C]">{r.duration}</p>
              </div>
              <div>
                <p className="text-[#B3ABD4]">停靠站數</p>
                <p className="mt-0.5 font-medium text-[#4A3B7C]">{r.stops} 站</p>
              </div>
              {isTrain && (
                <div>
                  <p className="text-[#B3ABD4]">全票</p>
                  <p className="mt-0.5 font-medium text-[#4A3B7C]">{r.fare ?? "—"}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {visibleResults.length > 0 && (
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
        open={pickerTarget !== null}
        mode={mode}
        onClose={() => setPickerTarget(null)}
        onSelectGroup={addPickerTargetToGroup}
        onCreateGroup={createGroupAndAddPickerTarget}
      />
    </div>
  );
}
