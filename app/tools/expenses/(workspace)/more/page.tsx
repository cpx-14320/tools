import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "更多" };

const items = [
  { href: "/tools/expenses/categories", label: "消費分類", icon: "🏷️", desc: "管理自訂分類" },
  { href: "/tools/expenses/salary/types", label: "薪資明細類型", icon: "📑", desc: "加項／扣項設定" },
  { href: "/tools/expenses/members", label: "成員", icon: "👥", desc: "邀請碼、移除成員" },
  { href: "/tools/expenses/reports", label: "報表", icon: "📈", desc: "趨勢圖表" },
  { href: "/tools/expenses/goals", label: "存錢目標", icon: "🎯", desc: "設定目標、追蹤進度" },
  { href: "/tools/expenses/recurring", label: "固定收支", icon: "🔁", desc: "電話費、房租這種週期收支" },
  { href: "/tools/expenses/more/export", label: "匯出消費紀錄", icon: "📤", desc: "選區間匯出 CSV" },
  { href: "/tools/expenses/more/import", label: "匯入消費紀錄", icon: "📥", desc: "上傳 CSV 批次新增" },
  { href: "/tools/expenses/more/salary-export", label: "匯出薪資紀錄", icon: "📤", desc: "選區間匯出 CSV" },
  { href: "/tools/expenses/more/salary-import", label: "匯入薪資紀錄", icon: "📥", desc: "上傳 CSV 批次新增" },
];

export default function MorePage() {
  return (
    <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#ECE4FA] bg-white">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="flex items-center gap-3 px-4 py-3.5 active:bg-[#F3EFFC]">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#F3EFFC] text-lg">{item.icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-[#4A3B7C]">{item.label}</span>
            <span className="block text-xs text-[#9C94C4]">{item.desc}</span>
          </span>
          <span aria-hidden className="text-[#9C94C4]">
            ›
          </span>
        </Link>
      ))}
    </div>
  );
}
