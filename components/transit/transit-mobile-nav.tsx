"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { IconImg } from "./icon-img";
import { ICON_PATHS } from "./icon-paths";

const tabs = [
  { href: "/tools/transit", label: "首頁", icon: ICON_PATHS.navHome },
  { href: "/tools/transit/trips", label: "我的行程", icon: ICON_PATHS.navTrips },
  { href: "/tools/transit/more", label: "設定", icon: ICON_PATHS.navOther },
];

// 搜尋結果頁 /tools/transit/results 本身不屬於任何一個分頁，單純比對 pathname 的話
// 三個分頁都不會亮；從首頁／我的行程搜尋時，網址帶上 from 參數記錄是從哪個分頁點進來
// 的，導覽列才知道要幫哪個分頁保持亮著，而不是進了搜尋結果頁三個分頁都暗掉。
const RESULTS_FROM_HREF: Record<string, string> = {
  home: "/tools/transit",
  trips: "/tools/transit/trips",
};

export function TransitMobileNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const resultsFrom = pathname.startsWith("/tools/transit/results") ? RESULTS_FROM_HREF[searchParams.get("from") ?? ""] : null;

  return (
    // fixed 貼在手機外觀容器（卡片）正下方——TransitMobileShell 的卡片容器本身有
    // transform，會變成 fixed 後代的定位基準，不是整個瀏覽器視窗，所以 inset-x-0
    // 直接就貼齊卡片左右邊界，不用再額外用 mx-auto／max-w 去手動湊寬度。
    <div className="fixed inset-x-0 bottom-0 z-10">
      <nav
        className="flex items-center justify-around border-t border-[#ECE4FA] bg-white px-2 py-2.5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
      >
        {tabs.map((tab) => {
          const active = resultsFrom ? tab.href === resultsFrom : tab.href === "/tools/transit" ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link key={tab.href} href={tab.href} className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px]">
              <IconImg src={tab.icon} alt={tab.label} size={32} background={false} className={active ? "" : "opacity-50"} />
              <span className={active ? "font-semibold text-[#6F5FD6]" : "text-[#B3ABD4]"}>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
