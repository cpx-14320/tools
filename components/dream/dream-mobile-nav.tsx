"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconImg } from "./icon-img";
import { ICON_PATHS } from "./icon-paths";

const tabs = [
  { href: "/tools/transit", label: "首頁", icon: ICON_PATHS.navHome },
  { href: "/tools/transit/trips", label: "我的行程", icon: ICON_PATHS.navTrips },
  { href: "/tools/transit/favorites", label: "我的最愛", icon: ICON_PATHS.navFavorites },
  { href: "/tools/transit/more", label: "更多", icon: ICON_PATHS.navMore },
];

export function DreamMobileNav() {
  const pathname = usePathname();

  return (
    // fixed 貼在手機外觀容器（卡片）正下方——DreamMobileShell 的卡片容器本身有
    // transform，會變成 fixed 後代的定位基準，不是整個瀏覽器視窗，所以 inset-x-0
    // 直接就貼齊卡片左右邊界，不用再額外用 mx-auto／max-w 去手動湊寬度。
    <div className="fixed inset-x-0 bottom-0 z-10">
      <nav
        className="flex items-center justify-around border-t border-[#ECE4FA] bg-white px-2 py-2.5"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
      >
        {tabs.map((tab) => {
          const active = tab.href === "/tools/transit" ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link key={tab.href} href={tab.href} className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px]">
              <IconImg src={tab.icon} alt={tab.label} size={20} className={active ? "" : "opacity-50"} />
              <span className={active ? "font-semibold text-[#6F5FD6]" : "text-[#B3ABD4]"}>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
