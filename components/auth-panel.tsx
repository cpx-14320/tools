"use client";

import type { ReactNode } from "react";
import { TOOLS_REGISTRY } from "@/lib/tools-registry";
import { Card, CardBody } from "@/components/ui";

/** 登入／註冊兩頁共用的版型。
 *
 *  **手機跟桌機是兩種操作**：
 *    手機  打開就是要登入，所以整個畫面只有一張表單卡，標題一行帶過，手指一路往下填完。
 *    桌機  左邊放「這裡是什麼、有哪些工具」，右邊才是表單。桌機使用者多半是第一次從
 *          瀏覽器開這個網址，螢幕也有的是空間，光一張 400px 的表單浮在中間，看不出
 *          這是什麼服務。
 *
 *  左邊那欄是純文字、沒有任何輸入框，所以直接用 `hidden lg:block` 藏起來就好——表單
 *  本身從頭到尾只有一份，不會變成兩組 input 搶自動填入跟焦點。 */
export function AuthPanel({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  /** 表單本體（呼叫端自己的 <form>）。 */
  children: ReactNode;
  /** 卡片底下那行「還沒有帳號？註冊」之類的切換連結。 */
  footer: ReactNode;
}) {
  return (
    <div className="lg:grid lg:min-h-[520px] lg:grid-cols-[1fr_minmax(0,400px)] lg:items-center lg:gap-16">
      <div className="hidden lg:block">
        <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
        <p className="mt-2 text-sm text-muted">{description}</p>
        <ul className="mt-8 flex flex-col gap-3">
          {TOOLS_REGISTRY.map((tool) => (
            <li key={tool.toolId} className="flex items-center gap-3">
              {tool.iconImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tool.iconImage} alt="" className="size-10 shrink-0 object-contain" />
              ) : (
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-2 text-xl">{tool.icon}</span>
              )}
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{tool.name}</span>
                <span className="block text-xs text-muted">{tool.description}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mx-auto w-full max-w-sm lg:mx-0 lg:max-w-none">
        {/* 手機版的標題：桌機已經在左欄講過同一句，這裡就收起來，不要同一頁出現兩次。 */}
        <div className="mb-6 text-center lg:hidden">
          <h1 className="text-xl font-bold tracking-tight text-ink">{title}</h1>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>

        <Card>
          <CardBody>{children}</CardBody>
        </Card>

        <p className="mt-4 text-center text-sm text-muted">{footer}</p>
      </div>
    </div>
  );
}

/** 登入／註冊表單的欄位——標籤在上、輸入框在下，兩頁六個欄位都長一樣。
 *  本來每個欄位各自把同一串 class 複製一次，改一次圓角要改六個地方。 */
export function AuthField({
  label,
  hint,
  children,
}: {
  label: string;
  /** 欄位底下那行補充說明（例如「至少 8 個字元」）。 */
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const authInputClass =
  "rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted focus:border-brand";
