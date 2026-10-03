"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconImg } from "./icon-img";
import { ICON_PATHS } from "./icon-paths";

const tabs = [
  { href: "/tools/transit-dream", label: "首頁", icon: ICON_PATHS.navHome },
  { href: "/tools/transit-dream/trips", label: "我的行程", icon: ICON_PATHS.navTrips },
  { href: "/tools/transit-dream/favorites", label: "我的最愛", icon: ICON_PATHS.navFavorites },
  { href: "/tools/transit-dream/more", label: "更多", icon: ICON_PATHS.navMore },
];

export function DreamMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center justify-around border-t border-[#ECE4FA] bg-white px-2 py-2.5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}>
      {tabs.map((tab) => {
        const active = tab.href === "/tools/transit-dream" ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px]">
            <IconImg src={tab.icon} alt={tab.label} size={20} className={active ? "" : "opacity-50"} />
            <span className={active ? "font-semibold text-[#6F5FD6]" : "text-[#B3ABD4]"}>{tab.label}</span>
            {active && <span className="mt-0.5 h-1 w-1 rounded-full bg-[#6F5FD6]" />}
          </Link>
        );
      })}
    </nav>
  );
}
