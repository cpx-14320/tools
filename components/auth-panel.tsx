import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Card, CardBody, SectionLabel } from "@/components/ui";
import { TOOLS_REGISTRY } from "@/lib/tools-registry";

/** 登入／註冊兩頁共用的版型。
 *
 *  **一種版型**：原本是「手機＝只有一張表單卡／桌機＝左邊介紹右邊表單」兩欄版型。外殼
 *  改成不分寬度都是 430px 的 App 卡片之後（見 site-shell.tsx），兩欄版型沒有地方可以
 *  攤開，而且桌機使用者想知道的「這是什麼服務」改用同一份東西解決：標記＋標題在最上面，
 *  表單底下再列出「登入後可以用什麼」——那份清單在手機上也看得到，不是只有桌機有。
 *
 *  表單本體（`children`）由呼叫端自己的 <form> 提供，從頭到尾只有一份，不會像畫兩套
 *  版型時那樣變成兩組 input 搶自動填入跟焦點。 */
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
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex flex-col items-center gap-3 pt-2 text-center">
        <BrandMark size={56} />
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">{title}</h1>
          <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>
        </div>
      </div>

      <Card>
        <CardBody className="p-5">{children}</CardBody>
      </Card>

      <p className="text-center text-sm text-muted">{footer}</p>

      {/* 登入後有什麼可以用——第一次開這個網址的人只看到兩個輸入框的話，看不出這是什麼
          服務。純展示的清單，沒有連結（還沒登入，點了也只會被擋回來）。 */}
      <div className="mt-auto pt-2">
        <SectionLabel>登入後可以使用</SectionLabel>
        <div className="flex flex-col gap-2">
          {TOOLS_REGISTRY.map((tool) => (
            <div key={tool.toolId} className="flex items-center gap-3 rounded-2xl border border-line bg-surface/70 px-3.5 py-2.5">
              {tool.iconImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tool.iconImage} alt="" className="size-9 shrink-0 object-contain" />
              ) : (
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                  <i aria-hidden className="fa-solid fa-shapes text-sm" />
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{tool.name}</span>
                <span className="block truncate text-xs text-muted">{tool.description}</span>
              </span>
            </div>
          ))}
        </div>
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

/** 輸入框——淡紫底、聚焦時換成白底＋紫框，比照記帳本彈窗裡的輸入框手感。
 *  focus 的記號不要只靠邊框顏色（1px 的顏色變化在手機上幾乎看不到），加一圈淡紫光暈。 */
export const authInputClass =
  "rounded-xl border border-line bg-surface-2/60 px-3.5 py-3 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-brand focus:bg-surface focus:ring-2 focus:ring-brand/20";

/** 登入／註冊頁最下面那行切換連結（「還沒有帳號？註冊」）裡的那顆連結。 */
export function AuthSwitchLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-brand">
      {children}
    </Link>
  );
}
