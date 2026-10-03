"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/tools/expenses", label: "總覽", icon: "📊" },
  { href: "/tools/expenses/transactions", label: "消費紀錄", icon: "🧾" },
  { href: "/tools/expenses/categories", label: "消費分類", icon: "🏷️" },
  { href: "/tools/expenses/salary", label: "薪資紀錄", icon: "💰" },
  { href: "/tools/expenses/salary/types", label: "薪資明細類型", icon: "📑" },
  { href: "/tools/expenses/members", label: "成員", icon: "👥" },
  { href: "/tools/expenses/goals", label: "存錢目標", icon: "🎯" },
  { href: "/tools/expenses/reports", label: "報表", icon: "📈" },
];

export function ExpensesNav() {
  const pathname = usePathname();
  return (
    <nav className="mt-5 flex flex-col gap-0.5">
      {navItems.map((item) => {
        const active = item.href === "/tools/expenses" ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
              active ? "bg-brand-soft text-brand font-medium" : "text-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
