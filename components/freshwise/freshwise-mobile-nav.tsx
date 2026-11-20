"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaIcon } from "./fa-icon";
import { colors } from "./theme";

const TABS = [
  { href: "/tools/freshwise", label: "今日", icon: "house" },
  { href: "/tools/freshwise/browse", label: "行情", icon: "list-ul" },
  { href: "/tools/freshwise/basket", label: "我的菜籃", icon: "basket-shopping" },
  { href: "/tools/freshwise/more", label: "設定", icon: "gear" },
] as const;

/** 底部導覽列。圖示走 Font Awesome 而不是插畫 PNG——這個工具還沒有自己的插畫，用
 *  向量圖示至少是一致的；之後真的畫了插畫再換成 IconImg（搭乘車的做法）。 */
export function FreshwiseMobileNav() {
  const pathname = usePathname();

  return (
    // fixed 貼在手機框容器正下方——容器本身有 transform，會成為 fixed 後代的定位基準，
    // 不是瀏覽器視窗，所以 inset-x-0 直接貼齊卡片左右邊界，不用再用 mx-auto／max-w 湊。
    <div className="fixed inset-x-0 bottom-0 z-10">
      <nav
        className="flex items-center justify-around border-t bg-white px-2 py-2.5"
        style={{ borderColor: colors.border, paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
      >
        {TABS.map((tab) => {
          // 首頁要完全相等才算選中（不然每一頁都以 /tools/freshwise 開頭，首頁會永遠亮著）；
          // 其他分頁用 startsWith，底下的詳情頁（/browse/FA1 之類）才能讓所屬分頁保持亮著。
          const active = tab.href === "/tools/freshwise" ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link key={tab.href} href={tab.href} className="flex flex-1 flex-col items-center gap-1 py-1 text-[11px]">
              <FaIcon icon={tab.icon} size={18} className="" color={active ? colors.brand : colors.faint} />
              <span className={active ? "font-semibold" : ""} style={{ color: active ? colors.brand : colors.faint }}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
