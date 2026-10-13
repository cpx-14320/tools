"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/tools/expenses", label: "總覽", icon: "🏠" },
  { href: "/tools/expenses/transactions", label: "消費", icon: "🧾" },
  { href: "/tools/expenses/salary", label: "薪資", icon: "💰" },
  { href: "/tools/expenses/more", label: "更多", icon: "⋯" },
];

/** 比照搭乘車 TransitMobileNav 的樣式：固定貼齊卡片正下方、滿版橫列、只有上邊框，不是
 *  浮動的膠囊列。外殼（ExpensesMobileShell）的卡片容器本身有 transform，fixed 子孫會以
 *  卡片為定位基準，inset-x-0 直接貼齊卡片左右邊界，理由跟搭乘車那邊一樣。 */
export function ExpensesMobileNav() {
  const pathname = usePathname();

  return (
    <div className="fixed inset-x-0 bottom-0 z-10">
      <nav
        className="flex items-center justify-around border-t bg-white px-2 py-2.5"
        style={{ borderColor: "#ECE4FA", paddingBottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
      >
        {tabs.map((tab) => {
          const active =
            tab.href === "/tools/expenses"
              ? pathname === tab.href
              : tab.href === "/tools/expenses/more"
                ? [
                    "/tools/expenses/categories",
                    "/tools/expenses/salary/types",
                    "/tools/expenses/members",
                    "/tools/expenses/goals",
                    "/tools/expenses/recurring",
                    "/tools/expenses/reports",
                    "/tools/expenses/more",
                  ].some((p) => pathname.startsWith(p))
                : pathname.startsWith(tab.href);
          return (
            <Link key={tab.href} href={tab.href} className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px]">
              <span className={`text-2xl leading-none ${active ? "" : "opacity-50"}`} aria-hidden>
                {tab.icon}
              </span>
              <span style={{ color: active ? "#6F5FD6" : "#9C94C4", fontWeight: active ? 600 : 400 }}>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
