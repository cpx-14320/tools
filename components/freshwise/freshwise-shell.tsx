import type { ReactNode } from "react";
import { FreshwiseMobileShell } from "./freshwise-mobile-shell";
import { FreshwiseProvider } from "./store";
import { freshwiseUserData } from "@/lib/freshwise/page-data.server";
import { CompanionProvider } from "./companion-store";
import "./game.css";

/** 這個工具的外框：手機外觀的卡片 ＋ 客戶端狀態（偏好／菜籃／提示）的 Provider。
 *
 *  偏好與菜籃在這裡（伺服器端）從資料庫讀出來傳給 Provider，所以第一次算繪就是使用者
 *  真正的設定與菜籃，不會先顯示預設值再跳走，也不會閃一下「菜籃是空的」。三種資料
 *  （偏好、菜籃、夥伴進度）都跟著帳號，換裝置登入看到的是同一份。 */
export async function FreshwiseShell({ children }: { children: ReactNode }) {
  const { prefs, basket } = await freshwiseUserData();
  return (
    <CompanionProvider><FreshwiseProvider initialPrefs={prefs} initialBasket={basket}>
      <FreshwiseMobileShell>{children}</FreshwiseMobileShell>
    </FreshwiseProvider></CompanionProvider>
  );
}
