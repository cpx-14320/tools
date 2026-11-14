"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { TOOLS_REGISTRY } from "@/lib/tools-registry";

/** 工具入口頁。
 *
 *  **手機跟桌機是兩種操作、同一份資料**：手機上是一排由上往下、整列可點的清單（拇指
 *  只能在螢幕下半部左右移動，縱向清單最好按）；桌機上攤成卡片格（滑鼠可以直接指向任何
 *  一張卡，一眼看完全部工具，之後工具變多也只是多幾張卡，不會變成一條長清單）。
 *  兩種版型靠 responsive class 切換，不是各寫一份。 */
export function HubView() {
  const { user, loading } = useAuth();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink lg:text-3xl">選一個工具開始</h1>
        <p className="mt-1 text-sm text-muted">登入一次，底下的工具都能切換使用。</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3 lg:gap-4">
        {TOOLS_REGISTRY.map((tool) => {
          const hasAccess = !loading && (user?.tools ?? []).includes(tool.toolId);
          // 沒登入的人看到的不是「需要權限」而是「請先登入」，而且整張卡會把他帶去登入頁。
          // 本來兩種情況都寫「需要權限」又都不能點——沒登入的人會以為要跟管理員申請，
          // 實際上註冊完就有了。
          const needLogin = !loading && !user;
          const card = (
            <div
              className={`flex h-full items-center gap-4 rounded-[1.5rem] border border-line bg-surface p-4 shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)] transition-colors lg:flex-col lg:items-start lg:gap-3 lg:p-5 ${
                hasAccess ? "hover:border-brand" : needLogin ? "hover:border-brand" : "opacity-70"
              }`}
            >
              {tool.iconImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tool.iconImage}
                  alt=""
                  className={`size-12 shrink-0 object-contain lg:size-14 ${hasAccess || needLogin ? "" : "grayscale"}`}
                />
              ) : (
                <span
                  className={`grid size-12 shrink-0 place-items-center rounded-2xl bg-surface-2 text-2xl lg:size-14 ${
                    hasAccess || needLogin ? "" : "grayscale"
                  }`}
                >
                  {tool.icon}
                </span>
              )}
              <div className="min-w-0 flex-1 lg:flex-none">
                <p className="font-semibold text-ink lg:text-lg">{tool.name}</p>
                <p className="mt-0.5 text-sm text-muted">{tool.description}</p>
              </div>
              {/* 手機版右邊是「›」（整列可點的記號）；桌機版換成一行動作文字，卡片有自己的
                  邊界，不需要箭頭再指一次方向。 */}
              {hasAccess ? (
                <>
                  <span aria-hidden className="shrink-0 text-muted lg:hidden">
                    ›
                  </span>
                  <span className="hidden text-sm font-medium text-brand lg:block">開始使用 →</span>
                </>
              ) : needLogin ? (
                <>
                  <span aria-hidden className="shrink-0 text-muted lg:hidden">
                    ›
                  </span>
                  <span className="hidden text-sm font-medium text-brand lg:block">請先登入 →</span>
                </>
              ) : (
                <span className="shrink-0 rounded-full border border-dashed border-line px-2.5 py-0.5 text-xs font-medium text-muted">
                  需要權限
                </span>
              )}
            </div>
          );

          if (hasAccess) {
            return (
              <Link key={tool.toolId} href={tool.href} className="block">
                {card}
              </Link>
            );
          }
          if (needLogin) {
            return (
              <Link key={tool.toolId} href="/login" className="block">
                {card}
              </Link>
            );
          }
          return <div key={tool.toolId}>{card}</div>;
        })}
      </div>
    </div>
  );
}
