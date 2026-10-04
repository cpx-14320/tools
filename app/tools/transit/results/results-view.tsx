"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconImg } from "@/components/dream/icon-img";
import { ICON_PATHS } from "@/components/dream/icon-paths";
import { scrollContainerToTop, scrollWithin } from "@/lib/scroll-within";

export type Mode = "bus" | "train" | "metro" | "thsr";

const MODE_META: Record<Mode, { label: string; icon: string }> = {
  train: { label: "火車", icon: ICON_PATHS.modeTrain },
  thsr: { label: "高鐵", icon: ICON_PATHS.modeThsr },
  bus: { label: "公車", icon: ICON_PATHS.modeBus },
  metro: { label: "捷運", icon: ICON_PATHS.modeMetro },
};

const TRAIN_STYLE: Record<string, string> = {
  自強: "bg-[#FBE3E8] text-[#D1517E]",
  莒光: "bg-[#FDE7D8] text-[#D97A3D]",
  區間: "bg-[#DCEAFC] text-[#3B6FD1]",
  區間快: "bg-[#DCF3EC] text-[#2FAE82]",
  普悠瑪: "bg-[#F0E8FC] text-[#9A5FD6]",
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

const MODE_STYLE: Record<Mode, string> = {
  train: "",
  thsr: "bg-[#F3E8FC] text-[#9A5FD6]",
  bus: "bg-[#E3F6EC] text-[#2FAE82]",
  metro: "bg-[#E6EEFC] text-[#4E7FE0]",
};

function badgeClass(mode: Mode, code: string) {
  if (mode === "train") {
    return TRAIN_STYLE[trainTypeOf(code)];
  }
  return MODE_STYLE[mode];
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
}: {
  origin: string;
  dest: string;
  mode: Mode;
  date: string;
  time: string;
}) {
  const meta = MODE_META[mode];
  const isTrain = mode === "train";
  const { rows: trainRows, error: trainError } = useTrainResults(origin, dest, date, time);
  const results: ResultRow[] = isTrain ? trainRows ?? [] : MOCK_RESULTS[mode];
  const loading = isTrain && trainRows === null && !trainError;
  const [typeTab, setTypeTab] = useState("全部");
  const visibleResults = isTrain && typeTab !== "全部" ? results.filter((r) => trainTypeOf(r.code) === typeTab) : results;

  // 錨點效果：列表一出現（或切換車種頁籤）就跳到「還沒過站」的第一筆卡片，不用讓使用者
  // 自己往下滑過一排已經發車的班次才找到真正有用的那筆。全部都過站了就不特別捲動，
  // 留在最上面就好（捲到最後一筆past意義不大，使用者自己往下看就知道全部都過了）。
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    if (visibleResults.length === 0) return;
    const firstUpcoming = visibleResults.findIndex((r) => !r.isPast);
    const target = cardRefs.current[firstUpcoming];
    if (firstUpcoming > 0 && target) scrollWithin(target, "start");
  }, [visibleResults]);

  return (
    <div className="flex flex-col px-5 pb-6 pt-6">
      <div className="flex items-center gap-3">
        <Link
          href="/tools/transit"
          aria-label="返回首頁"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-[#F3EFFC] text-[#6F5FD6]"
        >
          ←
        </Link>
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-[#4A3B7C]">
            {origin} <span aria-hidden>→</span> {dest}
          </p>
          <p className="flex items-center gap-1 text-xs text-[#B3ABD4]">
            <IconImg src={meta.icon} alt={meta.label} size={12} />{" "}
            {meta.label}・
            {isTrain ? (loading ? "查詢中…" : `共 ${visibleResults.length} 筆班次`) : `共 ${results.length} 筆班次・之後會接真的即時資料`}
          </p>
        </div>
      </div>

      {isTrain && (
        <div className="-mx-5 mt-4 overflow-x-auto px-5">
          <div className="inline-flex items-center gap-1 rounded-full bg-[#F3EFFC] p-1">
            {TRAIN_TYPE_TABS.map((t) => {
              const active = typeTab === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeTab(t)}
                  className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    active ? "bg-white text-[#6F5FD6] shadow-[0_2px_8px_-2px_rgba(111,95,214,0.4)]" : "text-[#9C94C4]"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isTrain && trainError && <p className="mt-4 rounded-2xl bg-[#FDEEF0] px-4 py-3 text-xs text-[#D1517E]">{trainError}</p>}

      <div className="mt-4 flex flex-col gap-2.5">
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
                <p className="mt-0.5 text-xs text-[#9C94C4]">{r.duration}</p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1.5">
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
                <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badgeClass(mode, r.code)}`}>
                  <IconImg src={meta.icon} alt={meta.label} size={12} />{" "}
                  {/* 火車已經有上面的車種分類頁籤了，這裡不用再重複講車種名稱，只顯示車次號。 */}
                  {isTrain ? trainNumberOf(r.code) : r.code}
                  {mode === "bus" ? " 路" : ""}
                </span>
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

            {isTrain && r.operatingNote && <p className="mt-2 text-[11px] text-[#B3ABD4]">{r.operatingNote}</p>}
          </div>
        ))}
      </div>

      {visibleResults.length > 0 && (
        // 外層跟底部導覽列用同一套定位技巧（fixed inset-x-0 + mx-auto + max-w-430px）：
        // 寬螢幕時手機外框卡片是置中的，直接 fixed right-* 會貼齊整個瀏覽器視窗右邊、
        // 跟卡片分家飄走，要先框出跟卡片對齊的寬度，按鈕再相對這個寬度卡右下角。
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[430px]">
          <button
            type="button"
            onClick={() => {
              const main = document.querySelector("main");
              if (main) scrollContainerToTop(main);
            }}
            aria-label="回到頂部"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)", background: "linear-gradient(90deg, #8A7CEE, #6F5FD6)" }}
            className="pointer-events-auto absolute right-5 grid size-11 place-items-center rounded-full text-white shadow-[0_8px_20px_-6px_rgba(111,95,214,0.6)] transition-opacity hover:opacity-90"
          >
            ↑
          </button>
        </div>
      )}
    </div>
  );
}
