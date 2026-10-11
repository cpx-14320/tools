"use client";

import { FaIcon } from "./fa-icon";

/** 公車「附近站牌」、Ubike「附近站點」共用的定位按鈕——間距、字體大小粗細統一，呼叫端
 *  只決定標籤文字（附近站牌／附近站點）、目前是否已定位（active）、onClick 要做什麼。 */
export function NearbyButton({
  active,
  locating,
  label,
  onClick,
}: {
  active: boolean;
  locating: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locating}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-60 ${
        active ? "bg-[#F3EFFC] text-[#6F5FD6]" : "bg-[#6F5FD6] text-white"
      }`}
    >
      <FaIcon icon={active ? "xmark" : "location-dot"} size={12} className={active ? "text-[#6F5FD6]" : "text-white"} />
      {locating ? "定位中…" : active ? "取消定位" : label}
    </button>
  );
}
