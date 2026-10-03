"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/tools/expenses", label: "總覽", icon: "🏠" },
  { href: "/tools/expenses/transactions", label: "消費", icon: "🧾" },
  { href: "/tools/expenses/salary", label: "薪資", icon: "💰" },
  { href: "/tools/expenses/more", label: "更多", icon: "⋯" },
];

export function ExpensesMobileNav() {
  const pathname = usePathname();

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-[430px] px-3"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
    >
      <nav className="flex items-center rounded-full border border-line bg-surface/95 px-1 py-1 shadow-[0_8px_24px_-8px_rgba(42,37,80,0.25)] backdrop-blur">
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
                    "/tools/expenses/reports",
                    "/tools/expenses/more",
                  ].some((p) => pathname.startsWith(p))
                : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]"
            >
              <span
                className={`grid size-8 place-items-center rounded-full text-lg transition-colors ${
                  active ? "bg-brand text-brand-fg" : ""
                }`}
                aria-hidden
              >
                {tab.icon}
              </span>
              <span className={active ? "font-medium text-brand" : "text-muted"}>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
