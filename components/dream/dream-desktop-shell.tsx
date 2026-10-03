"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LayoutToggle } from "@/components/layout-toggle";
import { IconImg } from "./icon-img";
import { ICON_PATHS } from "./icon-paths";
import { usePageAction } from "./page-action-context";

const navItems = [
  { href: "/tools/transit", label: "首頁", icon: ICON_PATHS.navHome },
  { href: "/tools/transit/trips", label: "我的行程", icon: ICON_PATHS.navTrips },
  { href: "/tools/transit/favorites", label: "我的最愛", icon: ICON_PATHS.navFavorites },
  { href: "/tools/transit/more", label: "更多", icon: ICON_PATHS.navMore },
];

export function DreamDesktopShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { action } = usePageAction();

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #EDE6FB 0%, #F3E7F3 45%, #E7DEF9 100%)" }}>
      <div className="mx-auto flex w-[1200px] gap-8 px-6 py-8">
        <aside className="sticky top-8 h-fit w-56 shrink-0 self-start rounded-[1.75rem] bg-white/70 p-4 shadow-[0_8px_30px_-8px_rgba(111,95,214,0.25)] backdrop-blur">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xs font-medium text-[#8477C2] hover:text-[#6F5FD6]">
              ← cpx-tools
            </Link>
            <div className="flex items-center gap-2">
              <LayoutToggle className="bg-white" />
              {action && (
                <button
                  type="button"
                  onClick={action.onClick}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#ECE4FA] bg-white px-3 py-1.5 text-xs font-medium text-[#6F5FD6] shadow-sm"
                >
                  {action.label}
                </button>
              )}
            </div>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-[#4A3B7C]">
            <IconImg src={ICON_PATHS.modeTrain} alt="夢幻紫彩旅行" size={16} />
            夢幻紫彩旅行
          </p>
          <nav className="mt-5 flex flex-col gap-0.5">
            {navItems.map((item) => {
              const active = item.href === "/tools/transit" ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors ${
                    active ? "bg-[#6F5FD6] font-medium text-white" : "text-[#8477C2] hover:bg-[#F3EFFC]"
                  }`}
                >
                  <IconImg src={item.icon} alt={item.label} size={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0 flex-1 rounded-[1.75rem] bg-white/60 p-6 shadow-[0_8px_30px_-8px_rgba(111,95,214,0.2)] backdrop-blur">{children}</div>
      </div>
    </div>
  );
}
