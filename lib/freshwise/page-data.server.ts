// 每個 page.tsx 都要做的那幾件事，集中在這裡：讀使用者的偏好、算出「今天」、把價格簿
// 取回來。這樣五個頁面的 page.tsx 都只剩兩三行。

import { getSessionUser } from "../auth";
import { todayISO } from "./dates";
import { DEFAULT_PREFS } from "./prefs";
import { getPriceBook } from "./prices.server";
import { loadUserData } from "./user-data.server";
import type { BasketState } from "./basket";
import type { FreshwisePrefs, PriceBook } from "./types";

/**
 * 讀這個使用者的偏好與菜籃。
 *
 * 偏好一定要在算繪時就知道——價格是伺服器端從 MongoDB 算的，要先知道算哪個場所、哪個
 * 市場。本來放 cookie 就是為了這件事；改放資料庫之後一樣在這裡讀到，第一次算繪就是
 * 使用者真正的設定，不會先顯示預設值再跳走。多的只是一次小查詢，而這些頁面本來就要
 * 讀 Mongo 拿價格。
 *
 * 沒登入理論上進不來（layout 會擋），防禦性地回預設值。
 */
export async function freshwiseUserData(): Promise<{ prefs: FreshwisePrefs; basket: BasketState | null }> {
  const user = await getSessionUser();
  if (!user) return { prefs: DEFAULT_PREFS, basket: null };
  const data = await loadUserData(user.id);
  return { prefs: data.prefs, basket: data.basket };
}

export async function freshwisePrefs(): Promise<FreshwisePrefs> {
  return (await freshwiseUserData()).prefs;
}

export interface FreshwisePageData {
  today: string;
  prefs: FreshwisePrefs;
  book: PriceBook;
  /** 伺服器已經讀到的菜籃，直接當 Provider 的初始值用——不用等瀏覽器掛載後再抓一次。 */
  basket: BasketState | null;
}

/**
 * 首頁、行情頁、我的菜籃共用的那一包資料。
 *
 * 「今天」在這裡算一次（台灣時區）再往下傳，client 元件不要自己叫 todayISO()——
 * 伺服器與瀏覽器各算一次的話，跨午夜時會對不起來。
 */
export async function freshwisePageData(): Promise<FreshwisePageData> {
  const { prefs, basket } = await freshwiseUserData();
  const today = todayISO();
  const book = await getPriceBook(prefs.venue, today, prefs.marketCode);
  return { today, prefs, book, basket };
}
