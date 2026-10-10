"use client";

import { useEffect, useState } from "react";
import { BottomSheetModal } from "./bottom-sheet-modal";
import { STATIONS_BY_CITY } from "./stations-data";
import type { BusEtaStatus } from "@/lib/transit/bus-routing";

export interface BusRouteSelection {
  cityName: string;
  routeName: string;
  /** 0＝去程、1＝返程，跟 TDX StopOfRoute 的 Direction 欄位同一套編號。 */
  direction: 0 | 1;
  stopName: string;
}

// 公車路線是分縣市查的（TDX 沒有「全國一張表」），跟首頁原本公車站牌選擇器共用同一份
// 縣市清單（lib/bus-routing.ts 的 BUS_CITY_CODE 也是同一組 key）。
const BUS_CITIES = Object.keys(STATIONS_BY_CITY.bus);

interface BusStopEta {
  name: string;
  status: BusEtaStatus;
  etaMinutes: number | null;
}

interface StopRouteEta {
  routeName: string;
  direction: 0 | 1;
  status: BusEtaStatus;
  etaMinutes: number | null;
}

// 文字說明照 lib/bus-routing.ts 的分類：ok 才有倒數分鐘可以顯示，其他狀態只顯示文字。
const STATUS_LABEL: Record<BusEtaStatus, string> = {
  ok: "",
  arriving: "進站中",
  notStarted: "未發車",
  pastLast: "末班已過",
  unavailable: "無資料",
};

export function etaLabel(eta: { status: BusEtaStatus; etaMinutes: number | null }): string {
  return eta.status === "ok" && eta.etaMinutes !== null ? `${eta.etaMinutes} 分` : STATUS_LABEL[eta.status];
}

// ok 底下再依「快到了沒」分橘／綠兩種色調，是畫面上額外的呈現判斷（3 分鐘內比較搶眼），
// 不是 TDX 另外給的分類。
export function etaToneStyle(eta: { status: BusEtaStatus; etaMinutes: number | null }): string {
  if (eta.status === "ok") {
    return eta.etaMinutes !== null && eta.etaMinutes <= 3 ? "bg-[#FDE7D8] text-[#D97A3D]" : "bg-[#E3F6EC] text-[#2FAE82]";
  }
  if (eta.status === "arriving") return "bg-[#FDEEF0] text-[#D1517E]";
  return "bg-[#F3EFFC] text-[#B3ABD4]";
}

// 路線色塊：淺底＋飽和字，沿用專案已經在用的色票（公車路線徽章綠色、捷運線色標籤同一套
// 視覺語言）；棕／橘／黃／F／小／幹線目前沒有現成色票，新配但維持同一套風格。用路線
// 名稱「開頭那個字」對應色塊，查不到就退回中性灰。
const ROUTE_COLOR_PREFIX_STYLE: Record<string, string> = {
  紅: "bg-[#FDEEF0] text-[#D1517E]",
  藍: "bg-[#E6EEFC] text-[#4E7FE0]",
  綠: "bg-[#E3F6EC] text-[#2FAE82]",
  棕: "bg-[#F5EDE4] text-[#9C6B3E]",
  橘: "bg-[#FDE7D8] text-[#D97A3D]",
  黃: "bg-[#FEF6D8] text-[#C9971F]",
  F: "bg-[#E8F7F3] text-[#2BA38A]",
  小: "bg-[#F3EFFC] text-[#6F5FD6]",
  幹: "bg-[#EDEAFC] text-[#8477C2]",
};

export function routeBadgeStyle(routeName: string): string {
  const prefix = routeName.match(/^(紅|藍|綠|棕|橘|黃|F|小|幹)/)?.[1];
  return (prefix && ROUTE_COLOR_PREFIX_STYLE[prefix]) || "bg-[#E3F6EC] text-[#2FAE82]";
}

// 自訂數字／色塊鍵盤，不用瀏覽器原生的文字鍵盤——路線編號常常是「數字＋顏色字」組合
// （例如「紅29」），色塊鍵直接插入對應的字，比切輸入法打字快很多。4 欄 5 列排版，目前
// 4 個縣市共用同一組按鍵（之前分析過台北／新北的真實路線前綴不完全一樣，但查詢本身已經
// 是依選定縣市查真實資料，按到不存在的前綴就是「沒有符合的路線」，不會查錯）。
const KEYPAD_ROWS: { label: string; insert: string; tone?: keyof typeof ROUTE_COLOR_PREFIX_STYLE }[][] = [
  [
    { label: "1", insert: "1" },
    { label: "2", insert: "2" },
    { label: "3", insert: "3" },
    { label: "紅", insert: "紅", tone: "紅" },
  ],
  [
    { label: "4", insert: "4" },
    { label: "5", insert: "5" },
    { label: "6", insert: "6" },
    { label: "藍", insert: "藍", tone: "藍" },
  ],
  [
    { label: "7", insert: "7" },
    { label: "8", insert: "8" },
    { label: "9", insert: "9" },
    { label: "綠", insert: "綠", tone: "綠" },
  ],
  [
    { label: "F", insert: "F", tone: "F" },
    { label: "0", insert: "0" },
    { label: "小", insert: "小", tone: "小" },
    { label: "棕", insert: "棕", tone: "棕" },
  ],
  [
    { label: "橘", insert: "橘", tone: "橘" },
    { label: "黃", insert: "黃", tone: "黃" },
    { label: "幹線", insert: "幹線", tone: "幹" },
    { label: "⌫", insert: "" },
  ],
];

type Step = { kind: "search" } | { kind: "routeDetail"; routeName: string } | { kind: "stopDetail"; stopName: string };

// 路線詳情、站牌詳情兩個 step 都需要「去程／返程切換 tabs」＋「重新搜尋」並排在同一行，
// 重新搜尋固定靠右——抽成共用小元件，不要兩處各寫一份幾乎一樣的 JSX。
function DirectionTabsRow({
  direction,
  onChangeDirection,
  onBack,
}: {
  direction: 0 | 1;
  onChangeDirection: (d: 0 | 1) => void;
  onBack: () => void;
}) {
  return (
    <div className="mb-1 flex items-center justify-between gap-2">
      <div className="inline-flex items-center gap-1 rounded-full bg-[#F3EFFC] p-1">
        {([0, 1] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onChangeDirection(d)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              direction === d ? "bg-white text-[#6F5FD6] shadow-[0_2px_8px_-2px_rgba(111,95,214,0.4)]" : "text-[#9C94C4]"
            }`}
          >
            {d === 0 ? "去程" : "返程"}
          </button>
        ))}
      </div>
      <button type="button" onClick={onBack} className="shrink-0 text-xs font-medium text-[#6F5FD6]">
        ‹ 重新搜尋
      </button>
    </div>
  );
}

export function BusRoutePickerModal({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial?: Partial<BusRouteSelection>;
  onClose: () => void;
  onSave: (selection: BusRouteSelection) => void;
}) {
  const [step, setStep] = useState<Step>({ kind: "search" });
  const [searchMode, setSearchMode] = useState<"route" | "stop">("route");
  const [query, setQuery] = useState("");
  const [cityName, setCityName] = useState(initial?.cityName && BUS_CITIES.includes(initial.cityName) ? initial.cityName : BUS_CITIES[0]);
  const [direction, setDirection] = useState<0 | 1>(initial?.direction ?? 0);

  const [routeResults, setRouteResults] = useState<string[]>([]);
  const [stopResults, setStopResults] = useState<string[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // 搜尋路線／站牌：依目前選的縣市＋輸入字即時查真實 TDX 資料，不是前端自己過濾假清單。
  // 小鍵盤／文字框每打一個字就會變動查詢字，debounce 200ms 再查，不用每個按鍵都打一次。
  useEffect(() => {
    if (step.kind !== "search") return;
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect */
    setSearchLoading(true);
    setSearchError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    const timer = setTimeout(() => {
      const endpoint = searchMode === "route" ? "routes" : "stops";
      const key = searchMode === "route" ? "routes" : "stops";
      const qs = new URLSearchParams({ city: cityName, q: query });
      fetch(`/api/transit/bus/${endpoint}?${qs.toString()}`)
        .then((res) => res.json())
        .then((data: { routes?: string[]; stops?: string[]; error?: string }) => {
          if (cancelled) return;
          if (data.error) setSearchError(data.error);
          if (key === "routes") setRouteResults(data.routes ?? []);
          else setStopResults(data.stops ?? []);
        })
        .catch(() => {
          if (!cancelled) setSearchError("查詢失敗，請稍後再試");
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [step.kind, searchMode, query, cityName]);

  const routeNameForDetail = step.kind === "routeDetail" ? step.routeName : null;
  const [routeStops, setRouteStops] = useState<BusStopEta[] | null>(null);
  const [routeStopsError, setRouteStopsError] = useState<string | null>(null);

  // 路線詳情：某條路線＋某個方向的真實站序，每一站都帶即時到站狀態。
  useEffect(() => {
    if (!routeNameForDetail) return;
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect */
    setRouteStops(null);
    setRouteStopsError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    const qs = new URLSearchParams({ city: cityName, route: routeNameForDetail, direction: String(direction) });
    fetch(`/api/transit/bus/route-stops?${qs.toString()}`)
      .then((res) => res.json())
      .then((data: { stops?: BusStopEta[]; error?: string }) => {
        if (cancelled) return;
        if (data.error) setRouteStopsError(data.error);
        setRouteStops(data.stops ?? []);
      })
      .catch(() => {
        if (!cancelled) setRouteStopsError("查詢失敗，請稍後再試");
      });
    return () => {
      cancelled = true;
    };
  }, [routeNameForDetail, direction, cityName]);

  const stopNameForDetail = step.kind === "stopDetail" ? step.stopName : null;
  const [stopRoutes, setStopRoutes] = useState<StopRouteEta[] | null>(null);
  const [stopRoutesError, setStopRoutesError] = useState<string | null>(null);

  // 站牌詳情：目前有停靠這個站牌的所有路線（去程／返程分開），各自帶即時到站狀態。
  useEffect(() => {
    if (!stopNameForDetail) return;
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect */
    setStopRoutes(null);
    setStopRoutesError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    const qs = new URLSearchParams({ city: cityName, stop: stopNameForDetail });
    fetch(`/api/transit/bus/stop-routes?${qs.toString()}`)
      .then((res) => res.json())
      .then((data: { routes?: StopRouteEta[]; error?: string }) => {
        if (cancelled) return;
        if (data.error) setStopRoutesError(data.error);
        setStopRoutes(data.routes ?? []);
      })
      .catch(() => {
        if (!cancelled) setStopRoutesError("查詢失敗，請稍後再試");
      });
    return () => {
      cancelled = true;
    };
  }, [stopNameForDetail, cityName]);

  // 站牌詳情也要能用去程／返程 tabs 切換：查回來的清單本來就每筆各自帶真實方向，這裡只是
  // 依目前選的方向過濾顯示，不用另外多打一次 API。
  const stopRoutesForDirection = (stopRoutes ?? []).filter((r) => r.direction === direction);

  if (!open) return null;

  function close() {
    setStep({ kind: "search" });
    setSearchMode("route");
    setQuery("");
    setDirection(0);
    onClose();
  }

  function pickFromRouteDetail(routeName: string, stopName: string) {
    onSave({ cityName, routeName, direction, stopName });
    close();
  }

  function pickFromStopDetail(routeName: string, routeDirection: 0 | 1, stopName: string) {
    onSave({ cityName, routeName, direction: routeDirection, stopName });
    close();
  }

  const title = step.kind === "search" ? "選擇公車路線或站牌" : step.kind === "routeDetail" ? step.routeName : step.kind === "stopDetail" ? step.stopName : "";

  return (
    <BottomSheetModal
      open={open}
      title={title}
      onClose={close}
      bodyClassName={step.kind === "search" ? "flex flex-col gap-3 px-5 py-5" : "flex flex-col gap-2 px-5 py-5"}
    >
      {step.kind === "search" && (
        <>
          <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-0.5">
            {BUS_CITIES.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => setCityName(city)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  cityName === city ? "bg-[#6F5FD6] text-white" : "bg-[#F3EFFC] text-[#9C94C4]"
                }`}
              >
                {city}
              </button>
            ))}
          </div>

          <div className="inline-flex w-fit items-center gap-1 self-start rounded-full bg-[#F3EFFC] p-1">
            {(["route", "stop"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setSearchMode(m);
                  setQuery("");
                }}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  searchMode === m ? "bg-white text-[#6F5FD6] shadow-[0_2px_8px_-2px_rgba(111,95,214,0.4)]" : "text-[#9C94C4]"
                }`}
              >
                {m === "route" ? "路線" : "站牌"}
              </button>
            ))}
          </div>

          {searchMode === "route" ? (
            <>
              <div className="flex min-h-11 items-center rounded-2xl border border-[#ECE4FA] bg-white px-4 py-2.5 text-sm font-medium text-[#4A3B7C]">
                {query || <span className="text-[#C7BFE6]">輸入路線編號，例如「紅29」</span>}
              </div>

              <div className="flex max-h-32 flex-col overflow-y-auto rounded-2xl border border-[#F2EEFA]">
                {searchLoading ? (
                  <p className="px-4 py-3 text-center text-xs text-[#B3ABD4]">搜尋中…</p>
                ) : searchError ? (
                  <p className="px-4 py-3 text-center text-xs text-[#D1517E]">{searchError}</p>
                ) : routeResults.length === 0 ? (
                  <p className="px-4 py-3 text-center text-xs text-[#B3ABD4]">沒有符合的路線</p>
                ) : (
                  routeResults.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setStep({ kind: "routeDetail", routeName: r })}
                      className="flex items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-[#F8F6FD]"
                    >
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${routeBadgeStyle(r)}`}>{r}</span>
                    </button>
                  ))
                )}
              </div>

              <div className="grid grid-cols-4 gap-2">
                {KEYPAD_ROWS.flat().map((key, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setQuery((q) => (key.label === "⌫" ? q.slice(0, -1) : q + key.insert))}
                    className={`rounded-2xl py-3 text-center text-sm font-semibold transition-colors ${
                      key.tone ? ROUTE_COLOR_PREFIX_STYLE[key.tone] : "bg-[#F8F6FD] text-[#4A3B7C] hover:bg-[#F3EFFC]"
                    }`}
                  >
                    {key.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="輸入站牌名稱"
                className="rounded-2xl border border-[#ECE4FA] bg-white px-4 py-3 text-sm font-medium text-[#4A3B7C] outline-none focus:border-[#6F5FD6]"
              />
              <div className="flex max-h-72 flex-col overflow-y-auto rounded-2xl border border-[#F2EEFA]">
                {searchLoading ? (
                  <p className="px-4 py-3 text-center text-xs text-[#B3ABD4]">搜尋中…</p>
                ) : searchError ? (
                  <p className="px-4 py-3 text-center text-xs text-[#D1517E]">{searchError}</p>
                ) : stopResults.length === 0 ? (
                  <p className="px-4 py-3 text-center text-xs text-[#B3ABD4]">沒有符合的站牌</p>
                ) : (
                  stopResults.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStep({ kind: "stopDetail", stopName: s })}
                      className="px-4 py-2.5 text-left text-sm font-medium text-[#4A3B7C] transition-colors hover:bg-[#F8F6FD]"
                    >
                      {s}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </>
      )}

      {step.kind === "routeDetail" && (
        <>
          <DirectionTabsRow direction={direction} onChangeDirection={setDirection} onBack={() => setStep({ kind: "search" })} />
          <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#F2EEFA]">
            {routeStops === null ? (
              <p className="px-4 py-3 text-center text-xs text-[#B3ABD4]">查詢中…</p>
            ) : routeStopsError ? (
              <p className="px-4 py-3 text-center text-xs text-[#D1517E]">{routeStopsError}</p>
            ) : routeStops.length === 0 ? (
              <p className="px-4 py-3 text-center text-xs text-[#B3ABD4]">查不到這個方向的站序</p>
            ) : (
              routeStops.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => pickFromRouteDetail(step.routeName, s.name)}
                  className="flex items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-[#F8F6FD]"
                >
                  <span className="text-sm font-medium text-[#4A3B7C]">{s.name}</span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${etaToneStyle(s)}`}>{etaLabel(s)}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}

      {step.kind === "stopDetail" && (
        <>
          <DirectionTabsRow direction={direction} onChangeDirection={setDirection} onBack={() => setStep({ kind: "search" })} />
          <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#F2EEFA]">
            {stopRoutes === null ? (
              <p className="px-4 py-3 text-center text-xs text-[#B3ABD4]">查詢中…</p>
            ) : stopRoutesError ? (
              <p className="px-4 py-3 text-center text-xs text-[#D1517E]">{stopRoutesError}</p>
            ) : stopRoutes.length === 0 ? (
              <p className="px-4 py-3 text-center text-xs text-[#B3ABD4]">目前沒有路線經過這一站</p>
            ) : stopRoutesForDirection.length === 0 ? (
              <p className="px-4 py-3 text-center text-xs text-[#B3ABD4]">這個方向目前沒有路線經過這一站</p>
            ) : (
              stopRoutesForDirection.map((r) => (
                <button
                  key={r.routeName}
                  type="button"
                  onClick={() => pickFromStopDetail(r.routeName, r.direction, step.stopName)}
                  className="flex items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-[#F8F6FD]"
                >
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${routeBadgeStyle(r.routeName)}`}>{r.routeName}</span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${etaToneStyle(r)}`}>{etaLabel(r)}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </BottomSheetModal>
  );
}
