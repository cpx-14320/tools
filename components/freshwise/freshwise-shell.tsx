import type { ReactNode } from "react";
import { FreshwiseMobileShell } from "./freshwise-mobile-shell";
import { FreshwiseProvider } from "./store";
import { freshwisePrefs } from "@/lib/freshwise/page-data.server";

/** 這個工具的外框：手機外觀的卡片 ＋ 客戶端狀態（偏好／菜籃／提示）的 Provider。
 *
 *  偏好在這裡（伺服器端）從 cookie 讀出來傳給 Provider，所以第一次算繪就是使用者真正的
 *  設定，不會先顯示預設值再跳走。各頁的 page.tsx 也會各自讀一次同一份 cookie 來決定要
 *  取哪個場所的價格——兩邊讀的是同一個請求帶上來的同一份 cookie，不會不一致。 */
export async function FreshwiseShell({ children }: { children: ReactNode }) {
  const prefs = await freshwisePrefs();
  return (
    <FreshwiseProvider initialPrefs={prefs}>
      <FreshwiseMobileShell>{children}</FreshwiseMobileShell>
    </FreshwiseProvider>
  );
}
