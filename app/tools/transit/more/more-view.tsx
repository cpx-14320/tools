"use client";

import { ImageSlot } from "@/components/dream/image-slot";

interface MoreItem {
  label: string;
  // 先留空用漸層佔位，之後直接補上圖示路徑（例如 /icons/more-account.png）就會換成真的圖示。
  icon?: string;
}

interface MoreGroup {
  title: string;
  items: MoreItem[];
}

const GROUPS: MoreGroup[] = [
  {
    title: "帳戶",
    items: [{ label: "帳戶設定" }, { label: "通知設定" }, { label: "付款方式" }],
  },
  {
    title: "旅遊工具",
    items: [{ label: "常用路線" }, { label: "常用車站" }, { label: "時刻查詢" }, { label: "票價查詢" }],
  },
  {
    title: "支援與關於",
    items: [{ label: "常見問題" }, { label: "意見回饋" }, { label: "關於我們" }, { label: "隱私權政策" }],
  },
];

export function MoreView() {
  return (
    <div className="flex flex-col px-5 pb-6 pt-6">
      <h1 className="text-xl font-bold text-[#4A3B7C]">更多</h1>

      <div className="mt-5 flex flex-col gap-5">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <p className="mb-2 px-1 text-xs font-medium text-[#9C94C4]">{group.title}</p>
            <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl bg-white shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)]">
              {group.items.map((item) => (
                <button key={item.label} type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <ImageSlot alt={`${item.label}圖示`} src={item.icon} className="size-9 shrink-0 rounded-xl" />
                  <span className="flex-1 text-sm text-[#4A3B7C]">{item.label}</span>
                  <span aria-hidden className="text-[#C7BFE6]">
                    ›
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        <button
          type="button"
          className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-medium text-[#D1517E] shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)]"
        >
          登出
        </button>
      </div>
    </div>
  );
}
