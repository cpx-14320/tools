"use client";

import { useEffect, useState } from "react";
import { RouteModal } from "@/components/dream/route-modal";
import { ImageSlot } from "@/components/dream/image-slot";
import { IconImg } from "@/components/dream/icon-img";
import { ICON_PATHS } from "@/components/dream/icon-paths";

type Mode = "bus" | "train" | "metro" | "thsr";

const TABS: { key: Mode; label: string }[] = [
  { key: "bus", label: "公車" },
  { key: "train", label: "火車" },
  { key: "metro", label: "捷運" },
  { key: "thsr", label: "高鐵" },
];

const MODE_ICON: Record<Mode, string> = {
  train: ICON_PATHS.modeTrain,
  thsr: ICON_PATHS.modeThsr,
  bus: ICON_PATHS.modeBus,
  metro: ICON_PATHS.modeMetro,
};

const TRAIN_STYLE: Record<string, string> = {
  自強: "bg-[#FBE3E8] text-[#D1517E]",
  莒光: "bg-[#FDE7D8] text-[#D97A3D]",
  區間: "bg-[#DCEAFC] text-[#3B6FD1]",
};

const MODE_STYLE: Record<Mode, string> = {
  train: "",
  thsr: "bg-[#F3E8FC] text-[#9A5FD6]",
  bus: "bg-[#E3F6EC] text-[#2FAE82]",
  metro: "bg-[#E6EEFC] text-[#4E7FE0]",
};

function badgeClass(trip: { mode: Mode; code: string }) {
  if (trip.mode === "train") {
    const [trainType] = trip.code.split(" ");
    return TRAIN_STYLE[trainType];
  }
  return MODE_STYLE[trip.mode];
}

type StatusTone = "soon" | "later" | "done" | "cancelled";

const STATUS_STYLE: Record<StatusTone, string> = {
  soon: "bg-[#DFF4EB] text-[#2FAE82]",
  later: "bg-[#F3EFFC] text-[#9C94C4]",
  done: "bg-[#EDEAFC] text-[#8477C2]",
  cancelled: "bg-[#FBE3E8] text-[#D1517E]",
};

const SECTION_LABEL: Record<Mode, string> = {
  bus: "公車行程",
  train: "火車行程",
  metro: "捷運行程",
  thsr: "高鐵行程",
};

// 火車有 TDX 即時誤點資料（StationLiveBoard.DelayTime），高鐵沒有誤點 API，
// 公車／捷運只有到站倒數秒數、沒有「誤點」這個欄位，所以時間相關文字標題依車種而不同。
const DURATION_LABEL: Record<Mode, string> = {
  train: "車程時間",
  thsr: "車程時間",
  bus: "預估車程",
  metro: "預估車程",
};

// 公車／捷運的 TDX 端點是「路線＋站牌」查詢，沒有起訖站時刻表模型，所以無法像火車／高鐵
// 一樣用這張卡片的起訖站去查即時資料；火車查一次要打 2 個 TDX 端點（時刻表＋即時誤點看板），
// 高鐵只有時刻表、查一次打 1 個端點，這個花費數字直接對應帳號每分鐘 5 次的共用額度。
const CALL_COST: Record<Mode, number> = { train: 2, thsr: 1, bus: 0, metro: 0 };
const QUOTA_LIMIT = 5;
const QUOTA_WINDOW_MS = 60_000;

function toTraName(name: string): string {
  const base = name.replace(/站$/, "");
  const traditional: Record<string, string> = { 台北: "臺北", 台中: "臺中", 台南: "臺南", 台東: "臺東" };
  return traditional[base] ?? base;
}

function toThsrName(name: string): string {
  return name.replace(/站$/, "");
}

type LiveStatus = "loading" | "done" | "blocked" | "notfound" | "error";

interface UpcomingRow {
  time: string;
  code: string;
  note?: string;
  delayMinutes?: number;
}

interface LiveResult {
  status: LiveStatus;
  note?: string; // 高鐵：單一比對到的班次摘要（維持原本邏輯，暫不處理）
  delayMinutes?: number; // 高鐵專用
  rows?: UpcomingRow[]; // 火車：當天所有班次裡，取離現在最近的 3 班
  message?: string;
}

// 火車卡片頂部的狀態徽章改成顯示真實誤點狀況（取最近一班的誤點分鐘數），
// 查詢前／查無資料時顯示中性文字，不再使用假的「即將出發／已完成／已取消」。
function trainBadge(live: LiveResult | undefined): { text: string; tone: StatusTone } {
  if (!live) return { text: "尚未查詢", tone: "later" };
  if (live.status === "loading") return { text: "查詢中…", tone: "later" };
  if (live.status === "blocked") return { text: "額度已滿", tone: "later" };
  if (live.status === "error" || live.status === "notfound") return { text: "尚未查詢", tone: "later" };
  const soonest = live.rows?.[0];
  if (!soonest) return { text: "今日已無班次", tone: "later" };
  if (soonest.delayMinutes === undefined) return { text: "查無誤點資料", tone: "later" };
  if (soonest.delayMinutes === 0) return { text: "準點", tone: "soon" };
  return { text: `誤點 ${soonest.delayMinutes} 分`, tone: "cancelled" };
}

const TRIP_DATA: Record<Mode, Array<{
  month: string;
  day: string;
  weekday: string;
  origin: string;
  dest: string;
  depart: string;
  arrive: string;
  status: string;
  statusTone: StatusTone;
  mode: Mode;
  code: string;
  duration: string;
  stops: number;
}>> = {
  bus: [
    {
      month: "4月",
      day: "28",
      weekday: "(二)",
      origin: "台北轉運站",
      dest: "中壢站",
      depart: "08:15",
      arrive: "09:25",
      status: "3 天後出發",
      statusTone: "later",
      mode: "bus",
      code: "1861",
      duration: "1 小時 10 分",
      stops: 8,
    },
    {
      month: "3月",
      day: "10",
      weekday: "(二)",
      origin: "中壢站",
      dest: "桃園站",
      depart: "07:30",
      arrive: "08:05",
      status: "已完成",
      statusTone: "done",
      mode: "bus",
      code: "5096",
      duration: "35 分",
      stops: 6,
    },
    {
      month: "2月",
      day: "20",
      weekday: "(五)",
      origin: "台北轉運站",
      dest: "基隆站",
      depart: "06:50",
      arrive: "07:40",
      status: "已取消",
      statusTone: "cancelled",
      mode: "bus",
      code: "1813",
      duration: "50 分",
      stops: 5,
    },
  ],
  train: [
    {
      month: "4月",
      day: "26",
      weekday: "(六)",
      origin: "台北站",
      dest: "台中站",
      depart: "06:28",
      arrive: "08:36",
      status: "即將出發",
      statusTone: "soon",
      mode: "train",
      code: "自強 110",
      duration: "2 小時 8 分",
      stops: 3,
    },
    {
      month: "3月",
      day: "15",
      weekday: "(日)",
      origin: "台北站",
      dest: "高雄站",
      depart: "06:00",
      arrive: "08:32",
      status: "已完成",
      statusTone: "done",
      mode: "train",
      code: "自強 102",
      duration: "2 小時 32 分",
      stops: 3,
    },
    {
      month: "3月",
      day: "1",
      weekday: "(日)",
      origin: "台北站",
      dest: "台南站",
      depart: "07:15",
      arrive: "09:50",
      status: "已取消",
      statusTone: "cancelled",
      mode: "train",
      code: "自強 166",
      duration: "2 小時 35 分",
      stops: 4,
    },
  ],
  metro: [
    {
      month: "5月",
      day: "1",
      weekday: "(五)",
      origin: "台北車站",
      dest: "淡水站",
      depart: "10:00",
      arrive: "10:40",
      status: "5 天後出發",
      statusTone: "later",
      mode: "metro",
      code: "淡水信義線",
      duration: "40 分",
      stops: 12,
    },
    {
      month: "3月",
      day: "2",
      weekday: "(一)",
      origin: "台北車站",
      dest: "南港站",
      depart: "09:10",
      arrive: "09:35",
      status: "已完成",
      statusTone: "done",
      mode: "metro",
      code: "板南線",
      duration: "25 分",
      stops: 7,
    },
    {
      month: "2月",
      day: "18",
      weekday: "(三)",
      origin: "台北車站",
      dest: "動物園站",
      depart: "11:00",
      arrive: "11:30",
      status: "已取消",
      statusTone: "cancelled",
      mode: "metro",
      code: "文湖線",
      duration: "30 分",
      stops: 9,
    },
  ],
  thsr: [
    {
      month: "5月",
      day: "20",
      weekday: "(二)",
      origin: "台北站",
      dest: "左營站",
      depart: "14:20",
      arrive: "15:56",
      status: "24 天後出發",
      statusTone: "later",
      mode: "thsr",
      code: "605",
      duration: "1 小時 36 分",
      stops: 4,
    },
    {
      month: "2月",
      day: "28",
      weekday: "(六)",
      origin: "台中站",
      dest: "左營站",
      depart: "13:00",
      arrive: "13:40",
      status: "已完成",
      statusTone: "done",
      mode: "thsr",
      code: "412",
      duration: "40 分",
      stops: 2,
    },
    {
      month: "2月",
      day: "15",
      weekday: "(日)",
      origin: "台北站",
      dest: "台中站",
      depart: "16:10",
      arrive: "16:47",
      status: "已取消",
      statusTone: "cancelled",
      mode: "thsr",
      code: "210",
      duration: "37 分",
      stops: 1,
    },
  ],
};

export function TripsView() {
  const [tab, setTab] = useState<Mode>("bus");
  const [addRouteOpen, setAddRouteOpen] = useState(false);
  const [callLog, setCallLog] = useState<number[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [liveState, setLiveState] = useState<Record<string, LiveResult>>({});
  const trips = TRIP_DATA[tab];

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const quotaUsed = callLog.filter((t) => now - t < QUOTA_WINDOW_MS).length;
  const quotaRemaining = Math.max(0, QUOTA_LIMIT - quotaUsed);

  async function checkTrip(key: string, trip: (typeof trips)[number]) {
    const cost = CALL_COST[trip.mode];
    if (quotaRemaining < cost) {
      setLiveState((s) => ({ ...s, [key]: { status: "blocked" } }));
      return;
    }
    setCallLog((log) => [...log, ...Array(cost).fill(Date.now())]);
    setLiveState((s) => ({ ...s, [key]: { status: "loading" } }));

    try {
      if (trip.mode === "train") {
        const url = `/api/transit/tra/od-timetable?origin=${encodeURIComponent(toTraName(trip.origin))}&dest=${encodeURIComponent(toTraName(trip.dest))}`;
        const res = await fetch(url);
        const data: { rows?: (UpcomingRow & { isPast?: boolean })[]; error?: string } = await res.json();
        if (data.error || !data.rows || data.rows.length === 0) {
          setLiveState((s) => ({ ...s, [key]: { status: "notfound" } }));
          return;
        }
        const upcoming = data.rows.filter((r) => !r.isPast).slice(0, 3);
        setLiveState((s) => ({ ...s, [key]: { status: "done", rows: upcoming } }));
        return;
      }

      const url = `/api/transit/thsr/timetable?origin=${encodeURIComponent(toThsrName(trip.origin))}&dest=${encodeURIComponent(toThsrName(trip.dest))}`;
      const res = await fetch(url);
      const data: { rows?: { time: string; code: string; note?: string; delayMinutes?: number }[]; error?: string } = await res.json();
      if (data.error) {
        setLiveState((s) => ({ ...s, [key]: { status: "error", message: data.error } }));
        return;
      }
      const trainNo = trip.code.replace(/\D/g, "");
      const match = data.rows?.find((r) => r.code.includes(trainNo));
      if (!match) {
        setLiveState((s) => ({ ...s, [key]: { status: "notfound" } }));
        return;
      }
      setLiveState((s) => ({ ...s, [key]: { status: "done", note: match.note, delayMinutes: match.delayMinutes } }));
    } catch {
      setLiveState((s) => ({ ...s, [key]: { status: "error", message: "連線失敗" } }));
    }
  }

  return (
    <div className="flex flex-col px-5 pb-6 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#4A3B7C]">我的行程</h1>
        <button type="button" aria-label="更多" className="text-lg text-[#9C94C4]">
          •••
        </button>
      </div>

      <RouteModal key={tab} open={addRouteOpen} lockedMode={tab} title="新增行程" onClose={() => setAddRouteOpen(false)} />

      <div className="mt-4 inline-flex items-center gap-1 self-start rounded-full bg-[#F3EFFC] p-1">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                active ? "bg-white text-[#6F5FD6] shadow-[0_2px_8px_-2px_rgba(111,95,214,0.4)]" : "text-[#9C94C4]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#F6F3FD] px-3 py-2 text-xs text-[#6F5FD6]">
        <span>本分鐘可用即時查詢次數（火車/高鐵真實串接 TDX）</span>
        <span className="font-semibold">
          {quotaRemaining} / {QUOTA_LIMIT}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-[#4A3B7C]">{SECTION_LABEL[tab]}</p>
        <button
          type="button"
          onClick={() => setAddRouteOpen(true)}
          className="flex items-center gap-1 rounded-full bg-[#F3EFFC] px-3 py-1.5 text-xs font-medium text-[#6F5FD6]"
        >
          <span aria-hidden>＋</span> 新增
        </button>
      </div>

      {trips.length === 0 ? (
        <div className="mt-3 rounded-[1.5rem] bg-white py-10 text-center text-sm text-[#B3ABD4] shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)]">
          目前沒有符合的行程
        </div>
      ) : (
      <div className="mt-3 flex flex-col gap-3">
        {trips.map((trip, i) => {
          const key = `${tab}-${i}`;
          const live = liveState[key];
          const unsupported = trip.mode === "bus" || trip.mode === "metro";
          const isTrain = trip.mode === "train";
          const showUpcomingList = isTrain && live?.status === "done";
          const topBadge = isTrain ? trainBadge(live) : { text: trip.status, tone: trip.statusTone };

          return (
            <div key={key} className="rounded-[1.5rem] bg-white p-4 shadow-[0_6px_20px_-8px_rgba(111,95,214,0.25)]">
              <div className="flex items-start gap-3">
                <ImageSlot alt={`${trip.origin}到${trip.dest}路線圖示`} className="size-14 shrink-0 rounded-xl" />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#4A3B7C]">
                    {trip.origin} <span aria-hidden>→</span> {trip.dest}
                  </p>
                  <p className="mt-0.5 text-xs text-[#9C94C4]">
                    {trip.depart} <span aria-hidden>→</span> {trip.arrive}
                  </p>
                  <p className="mt-0.5 text-xs text-[#9C94C4]">
                    {DURATION_LABEL[trip.mode]}：{trip.duration}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_STYLE[topBadge.tone]}`}>
                    {topBadge.text}
                  </span>
                  <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badgeClass(trip)}`}>
                    <IconImg src={MODE_ICON[trip.mode]} alt={trip.mode} size={12} /> {trip.code}
                    {trip.mode === "bus" ? " 路" : ""}
                    <span aria-hidden className="ml-0.5">
                      ›
                    </span>
                  </span>
                </div>
              </div>

              {showUpcomingList ? (
                <div className="mt-3 flex flex-col divide-y divide-[#F2EEFA] border-t border-[#F2EEFA]">
                  {live?.rows && live.rows.length > 0 ? (
                    live.rows.map((r, idx) => (
                      <div key={idx} className="flex items-center gap-2 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-[#4A3B7C]">
                            {r.time} · {r.code}
                          </p>
                          {r.note && <p className="mt-1 truncate text-[11px] text-[#9C94C4]">{r.note}</p>}
                        </div>
                        {r.delayMinutes !== undefined && (
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              r.delayMinutes === 0 ? "bg-[#DFF4EB] text-[#2FAE82]" : "bg-[#FBE3E8] text-[#D1517E]"
                            }`}
                          >
                            {r.delayMinutes === 0 ? "準點" : `誤 ${r.delayMinutes} 分`}
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="py-2.5 text-xs text-[#B3ABD4]">今日已無後續班次</p>
                  )}
                </div>
              ) : (
                <div className="mt-3 border-t border-[#F2EEFA] pt-3 text-xs">
                  <p className="text-[#B3ABD4]">停靠站數</p>
                  <p className="mt-0.5 font-medium text-[#4A3B7C]">{trip.stops} 站</p>
                </div>
              )}

              <div className="mt-3 border-t border-[#F2EEFA] pt-3">
                {unsupported ? (
                  <p className="text-[11px] leading-relaxed text-[#B3ABD4]">
                    此車種無法用起訖站查詢即時資料（TDX 公車／捷運是路線＋站牌查詢模型，沒有起訖站時刻表 API）
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      disabled={live?.status === "loading"}
                      onClick={() => checkTrip(key, trip)}
                      className="flex items-center gap-1 self-start text-xs font-medium text-[#6F5FD6] disabled:opacity-50"
                    >
                      <IconImg src={ICON_PATHS.refresh} alt="重新查詢" size={12} />{" "}
                      {live ? "重新查詢" : "查即時資料"}（花費 {CALL_COST[trip.mode]} 次額度）
                    </button>
                    {live?.status === "loading" && <p className="text-xs text-[#9C94C4]">查詢中…</p>}
                    {live?.status === "blocked" && (
                      <p className="text-xs font-medium text-[#D1517E]">已達每分鐘 5 次查詢上限，請稍後再試</p>
                    )}
                    {live?.status === "notfound" && (
                      <p className="text-xs text-[#B3ABD4]">今日查無對應班次（可能非營運日或當日已過站）</p>
                    )}
                    {live?.status === "error" && <p className="text-xs text-[#D1517E]">{live.message ?? "查詢失敗"}</p>}
                    {!isTrain && live?.status === "done" && (
                      <div className="rounded-xl bg-[#F6F3FD] px-3 py-2 text-xs text-[#4A3B7C]">
                        <p className="font-medium">即時資料（今日）：{live.note}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
