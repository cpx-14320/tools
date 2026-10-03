"use client";

import { useState } from "react";
import { IconImg } from "@/components/dream/icon-img";
import { ICON_PATHS } from "@/components/dream/icon-paths";

export interface StationDraft {
  name: string;
  favorited: boolean;
}

export function StationsModal({
  open,
  initial,
  onClose,
}: {
  open: boolean;
  initial: StationDraft[];
  onClose: () => void;
}) {
  const [stations, setStations] = useState(initial);

  if (!open) return null;

  function toggle(name: string) {
    setStations((list) => list.map((s) => (s.name === name ? { ...s, favorited: !s.favorited } : s)));
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-[400px] flex-col rounded-t-[1.75rem] bg-white sm:rounded-[1.75rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#ECE4FA] px-5 py-4">
          <p className="font-semibold text-[#4A3B7C]">編輯常用車站</p>
          <button type="button" onClick={onClose} aria-label="關閉" className="grid size-8 place-items-center rounded-full text-[#9C94C4] hover:bg-[#F3EFFC]">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-2.5">
            {stations.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => toggle(s.name)}
                className="flex items-center gap-2 rounded-xl border border-[#ECE4FA] px-3 py-2.5"
              >
                <IconImg src={ICON_PATHS.station} alt="車站" size={16} />
                <span className="flex-1 truncate text-left text-sm text-[#4A3B7C]">{s.name}</span>
                <IconImg
                  src={s.favorited ? ICON_PATHS.heartFilled : ICON_PATHS.heartOutline}
                  alt={s.favorited ? "已收藏" : "未收藏"}
                  size={14}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#ECE4FA] px-5 py-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#9C94C4] hover:text-[#6F5FD6]">
            取消
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(111,95,214,0.6)]"
            style={{ background: "linear-gradient(90deg, #8A7CEE, #6F5FD6)" }}
          >
            儲存
          </button>
        </div>
      </div>
    </div>
  );
}
