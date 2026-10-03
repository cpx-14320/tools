import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "更多" };

const items = [
  { href: "/tools/expenses/categories", label: "消費分類", icon: "🏷️", desc: "管理自訂分類" },
  { href: "/tools/expenses/salary/types", label: "薪資明細類型", icon: "📑", desc: "加項／扣項設定" },
  { href: "/tools/expenses/members", label: "成員", icon: "👥", desc: "邀請碼、移除成員" },
  { href: "/tools/expenses/reports", label: "報表", icon: "📈", desc: "趨勢圖表" },
  { href: "/tools/expenses/goals", label: "存錢目標", icon: "🎯", desc: "設定目標、追蹤進度" },
  { href: "/tools/expenses/more/export", label: "匯出資料", icon: "📤", desc: "選區間匯出 CSV" },
  { href: "/tools/expenses/more/import", label: "匯入資料", icon: "📥", desc: "上傳 CSV 批次新增" },
];

export default function MorePage() {
  return (
    <div className="flex flex-col divide-y divide-line overflow-hidden rounded-[1.5rem] border border-line bg-surface">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="flex items-center gap-3 px-4 py-3.5 active:bg-surface-2">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-lg">{item.icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{item.label}</span>
            <span className="block text-xs text-muted">{item.desc}</span>
          </span>
          <span aria-hidden className="text-muted">
            ›
          </span>
        </Link>
      ))}
    </div>
  );
}
