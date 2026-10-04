"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { TOOLS_REGISTRY } from "@/lib/tools-registry";

const CURRENT_TOOL_ID = "transit";

export function MoreView() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  // 「其他小工具」只列使用者真的有權限、而且不是目前這個工具（搭乘車查詢）的項目。
  const otherTools = TOOLS_REGISTRY.filter((t) => t.toolId !== CURRENT_TOOL_ID && (user?.tools ?? []).includes(t.toolId));

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <div className="flex flex-col px-5 pb-6 pt-6">
      <h1 className="text-xl font-bold text-[#4A3B7C]">其他</h1>

      <div className="mt-5 flex flex-col gap-5">
        <div>
          <p className="mb-2 px-1 text-xs font-medium text-[#9C94C4]">其他小工具</p>
          <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl bg-white shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)]">
            {loading ? (
              <p className="px-4 py-3 text-sm text-[#B3ABD4]">載入中…</p>
            ) : otherTools.length === 0 ? (
              <p className="px-4 py-3 text-sm text-[#B3ABD4]">目前沒有其他小工具的使用權限</p>
            ) : (
              otherTools.map((tool) => (
                <Link key={tool.toolId} href={tool.href} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  {tool.iconImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tool.iconImage} alt={tool.name} className="size-10 shrink-0 object-contain" />
                  ) : (
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#F3EFFC] text-lg">{tool.icon}</span>
                  )}
                  <span className="flex-1 text-sm text-[#4A3B7C]">{tool.name}</span>
                  <span aria-hidden className="text-[#C7BFE6]">
                    ›
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-medium text-[#D1517E] shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)]"
        >
          登出
        </button>
      </div>
    </div>
  );
}
