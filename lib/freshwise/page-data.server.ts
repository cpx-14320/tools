// 每個 page.tsx 都要做的那幾件事，集中在這裡：讀使用者的偏好、算出「今天」、把價格簿
// 取回來。這樣五個頁面的 page.tsx 都只剩兩三行。

import { cookies } from "next/headers";
import { todayISO } from "./dates";
import { parsePrefs, PREFS_COOKIE } from "./prefs-cookie";
import { getPriceBook } from "./prices.server";
import type { FreshwisePrefs, PriceBook } from "./types";

/** 讀這個請求的偏好設定（沒有 cookie 就是預設值）。 */
export async function freshwisePrefs(): Promise<FreshwisePrefs> {
  const store = await cookies();
  return parsePrefs(store.get(PREFS_COOKIE)?.value);
}

export interface FreshwisePageData {
  today: string;
  prefs: FreshwisePrefs;
  book: PriceBook;
}

/**
 * 首頁、行情頁、我的菜籃共用的那一包資料。
 *
 * 「今天」在這裡算一次（台灣時區）再往下傳，client 元件不要自己叫 todayISO()——
 * 伺服器與瀏覽器各算一次的話，跨午夜時會對不起來。
 */
export async function freshwisePageData(): Promise<FreshwisePageData> {
  const prefs = await freshwisePrefs();
  const today = todayISO();
  const book = await getPriceBook(prefs.venue, today, prefs.marketCode);
  return { today, prefs, book };
}
