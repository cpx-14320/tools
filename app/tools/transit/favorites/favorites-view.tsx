"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageSlot } from "@/components/dream/image-slot";
import { IconImg } from "@/components/dream/icon-img";
import { ICON_PATHS } from "@/components/dream/icon-paths";
import { RouteModal, type RouteDraft } from "@/components/dream/route-modal";
import { StationsModal } from "./stations-modal";

const TABS = [
  { key: "routes", label: "常用路線" },
  { key: "stations", label: "常用車站" },
  { key: "saved", label: "收藏班次" },
];

const TRAIN_STYLE: Record<string, string> = {
  自強: "bg-[#FBE3E8] text-[#D1517E]",
  莒光: "bg-[#FDE7D8] text-[#D97A3D]",
  區間: "bg-[#DCEAFC] text-[#3B6FD1]",
};

const FREQUENT_ROUTES = [
  { origin: "台北站", dest: "台中站", duration: "約 2 小時 8 分", favorited: true },
  { origin: "台北站", dest: "高雄站", duration: "約 1 小時 36 分", favorited: true },
  { origin: "台中站", dest: "花蓮站", duration: "約 2 小時 34 分", favorited: true },
];

const FREQUENT_STATIONS = [
  { name: "台北站", favorited: true },
  { name: "台中站", favorited: false },
  { name: "高雄站", favorited: false },
  { name: "花蓮站", favorited: true },
  { name: "新竹站", favorited: false },
  { name: "台南站", favorited: false },
];

const SAVED_TRIPS = [
  { train: "自強 110", depart: "06:28", origin: "台北", arrive: "08:36", dest: "台中" },
  { train: "莒光 502", depart: "06:45", origin: "台北", arrive: "09:01", dest: "台中" },
  { train: "區間 2124", depart: "07:12", origin: "台北", arrive: "09:28", dest: "台中" },
];

export function FavoritesView() {
  const router = useRouter();
  const [tab, setTab] = useState("routes");
  const [routeModal, setRouteModal] = useState<{ open: boolean; initial?: RouteDraft }>({ open: false });
  const [stationsOpen, setStationsOpen] = useState(false);

  return (
    <div className="flex flex-col px-5 pb-6 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#4A3B7C]">我的最愛</h1>
        <button
          type="button"
          aria-label="新增"
          onClick={() => setRouteModal({ open: true })}
          className="grid size-7 place-items-center rounded-full bg-[#F3EFFC] text-lg text-[#6F5FD6]"
        >
          ＋
        </button>
      </div>

      <RouteModal open={routeModal.open} initial={routeModal.initial} onClose={() => setRouteModal({ open: false })} />
      <StationsModal open={stationsOpen} initial={FREQUENT_STATIONS} onClose={() => setStationsOpen(false)} />

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

      <div className="mt-5 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-[#4A3B7C]">
          <span aria-hidden className="text-[#C9A6F2]">
            ♦
          </span>
          常用路線
        </p>
        <button
          type="button"
          onClick={() => setRouteModal({ open: true, initial: FREQUENT_ROUTES[0] })}
          className="text-xs font-medium text-[#9C94C4]"
        >
          編輯
        </button>
      </div>

      <div className="mt-2 flex flex-col gap-2.5">
        {FREQUENT_ROUTES.map((r, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)]">
            <ImageSlot alt={`${r.origin}到${r.dest}`} className="size-12 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-[#4A3B7C]">
                {r.origin} <span aria-hidden>⇄</span> {r.dest}
                <IconImg
                  src={r.favorited ? ICON_PATHS.heartFilled : ICON_PATHS.heartOutline}
                  alt={r.favorited ? "已收藏" : "未收藏"}
                  size={14}
                />
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-[#9C94C4]">
                <IconImg src={ICON_PATHS.clock} alt="時間" size={12} /> {r.duration}
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/tools/transit/results?origin=${encodeURIComponent(r.origin)}&dest=${encodeURIComponent(r.dest)}`)}
              className="shrink-0 rounded-full bg-[#F3EFFC] px-3 py-1.5 text-xs font-medium text-[#6F5FD6]"
            >
              搜尋班次 →
            </button>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-[#4A3B7C]">
          <span aria-hidden className="text-[#C9A6F2]">
            ♦
          </span>
          常用車站
        </p>
        <button type="button" onClick={() => setStationsOpen(true)} className="text-xs font-medium text-[#9C94C4]">
          編輯
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2.5">
        {FREQUENT_STATIONS.map((s) => (
          <div key={s.name} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 shadow-[0_4px_14px_-6px_rgba(111,95,214,0.18)]">
            <IconImg src={ICON_PATHS.station} alt="車站" size={16} />
            <span className="flex-1 truncate text-sm text-[#4A3B7C]">{s.name}</span>
            <IconImg
              src={s.favorited ? ICON_PATHS.heartFilled : ICON_PATHS.heartOutline}
              alt={s.favorited ? "已收藏" : "未收藏"}
              size={14}
            />
          </div>
        ))}
      </div>

      <p className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-[#4A3B7C]">
        <span aria-hidden className="text-[#C9A6F2]">
          ♦
        </span>
        收藏班次
      </p>

      <div className="mt-2 flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl bg-white shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)]">
        {SAVED_TRIPS.map((t, i) => {
          const [trainType] = t.train.split(" ");
          return (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${TRAIN_STYLE[trainType]}`}>{t.train}</span>
              <p className="min-w-0 flex-1 truncate text-sm text-[#4A3B7C]">
                {t.depart} {t.origin} <span aria-hidden>→</span> {t.arrive} {t.dest}
              </p>
              <IconImg src={ICON_PATHS.heartFilled} alt="已收藏" size={14} />
              <span aria-hidden className="text-[#C7BFE6]">
                ⋮
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
