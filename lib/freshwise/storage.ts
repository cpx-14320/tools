// 舊版瀏覽器端儲存的搬家工具。
//
// 這個工具的三種使用者資料（偏好、菜籃、夥伴進度）現在都存在帳號底下（MongoDB）。
// 歷史上偏好放過 localStorage、再放過 cookie，菜籃一直在 localStorage——這支只剩一個
// 工作：把這台裝置上殘留的那一份交出來給伺服器，然後清掉。
//
// 搬完就不再有「瀏覽器端的使用者資料」了。

import { normalizeBasket, type BasketState } from "./basket";
import { normalizePrefs } from "./prefs";
import type { FreshwisePrefs } from "./types";

const BASKET_KEY = "freshwise.basket";
const PREFS_COOKIE = "freshwise_prefs";

export interface LegacyDeviceData {
  basket?: BasketState;
  prefs?: FreshwisePrefs;
}

function readLegacyCookie(): FreshwisePrefs | undefined {
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${PREFS_COOKIE}=`));
  if (!match) return undefined;
  try {
    return normalizePrefs(JSON.parse(decodeURIComponent(match.slice(PREFS_COOKIE.length + 1))));
  } catch {
    return undefined;
  }
}

/**
 * 把這台裝置上殘留的舊資料取出來並清掉（取了就不會再取第二次）。
 *
 * 回傳 `null` 代表這台裝置沒有舊資料——絕大多數情況都是這樣，搬家只會發生一次。
 * 清掉是在「交給伺服器之前」做的：就算送出失敗，使用者接下來看到的也是帳號裡那一份，
 * 不會出現「本機一份、雲端一份，每次重整換一種」的狀況。
 */
export function takeLegacyDeviceData(): LegacyDeviceData | null {
  if (typeof window === "undefined") return null;
  const data: LegacyDeviceData = {};

  try {
    const raw = localStorage.getItem(BASKET_KEY);
    if (raw) {
      data.basket = normalizeBasket(JSON.parse(raw));
      localStorage.removeItem(BASKET_KEY);
    }
  } catch {
    /* 無痕模式或關掉網站資料存取時 localStorage 會直接丟例外 */
  }

  const prefs = readLegacyCookie();
  if (prefs) {
    data.prefs = prefs;
    document.cookie = `${PREFS_COOKIE}=; path=/; max-age=0; samesite=lax`;
  }

  return data.basket || data.prefs ? data : null;
}
