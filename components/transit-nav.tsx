"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/tools/transit", label: "總覽", icon: "🏠" },
  { href: "/tools/transit/routes", label: "監控路線", icon: "🛤️" },
  { href: "/tools/transit/timetable", label: "時刻表查詢", icon: "🕒" },
  { href: "/tools/transit/notify", label: "通知設定", icon: "🔔" },
];

export function TransitNav() {
  const pathname = usePathname();
  return (
    <nav className="mt-5 flex flex-col gap-0.5">
      {navItems.map((item) => {
        const active = item.href === "/tools/transit" ? pathname === item.href : pathname.startsWith(item.href);
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
