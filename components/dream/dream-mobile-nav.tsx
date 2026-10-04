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
    // fixed 在手機外觀容器（最大 430px、置中）的正下方，不佔版面流動空間——
    // 跟 expenses-mobile-nav.tsx 同一套做法，main 要記得補對應的 padding-bottom，
    // 不然內容最下面會被這個 nav 蓋住。sm: 以上（寬螢幕時維持手機外觀）改回一般
    // 文件流排列：這種情況下卡片本身會置中顯示、不會貼齊視窗邊緣，fixed 是相對
    // 整個瀏覽器視窗定位，會讓 nav 跟卡片分家、懸空跑到視窗最下面。
    // sm:mx-0 很關鍵：static 時這個 div 是 flex-col 容器（卡片）的 flex item，
    // 殘留的 mx-auto（水平自動 margin）會讓 flexbox 的 stretch 失效、整個 nav
    // 縮成內容最小寬度，害「我的行程」「我的最愛」擠到換行——取消掉才會撐滿卡片寬度。
    <div className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-[430px] sm:static sm:mx-0 sm:max-w-none">
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
              {active && <span className="mt-0.5 h-1 w-1 rounded-full bg-[#6F5FD6]" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
