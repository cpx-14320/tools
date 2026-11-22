// 使用者的偏好與菜籃，存在 MongoDB、跟著帳號走。
//
// ## 為什麼從 cookie / localStorage 搬過來
//
// 偏好本來在 cookie、菜籃本來在 localStorage。兩者都是「跟著這台瀏覽器」而不是「跟著
// 這個人」：手機上把菜籃清空，換電腦登入同一個帳號，舊的菜籃還在——使用者合理地會
// 認為那是同步壞掉。清一次瀏覽資料、換一支手機，整個菜籃就不見了。
//
// 現在三種資料（夥伴進度、偏好、菜籃）都在帳號底下。夥伴另外一份文件（更新頻率完全
// 不同，見 companions.server.ts），偏好與菜籃放同一份——每次算繪頁面都要讀偏好，順便
// 把菜籃一起帶回來只要一次查詢。
//
// 偏好仍然需要在 **Server Component 算繪時** 就知道（價格是伺服器端算的，要先知道算
// 哪個場所），所以這支是 server-only，由 page-data.server.ts 呼叫。

import type { Collection } from "mongodb";
import { getDb } from "../mongodb";
import { defaultBasket, normalizeBasket, type BasketState } from "./basket";
import { DEFAULT_PREFS, normalizePrefs } from "./prefs";
import type { FreshwisePrefs } from "./types";

interface UserDataDoc {
  _id: string;
  prefs?: FreshwisePrefs;
  basket?: BasketState;
  updatedAt: Date;
}

export interface FreshwiseUserData {
  prefs: FreshwisePrefs;
  basket: BasketState;
  /** 這個帳號在資料庫裡還沒有任何資料——第一次用，可以接受從裝置搬家。 */
  fresh: boolean;
}

async function coll(): Promise<Collection<UserDataDoc>> {
  return (await getDb()).collection<UserDataDoc>("freshwise.userData");
}

/**
 * 讀一個使用者的偏好與菜籃。
 *
 * 每個欄位都走 normalize：資料庫裡可能留著改版前的舊格式（例如之後新增第四種場所又
 * 移除），一個壞欄位不該讓整組設定重置。
 */
export async function loadUserData(userId: string): Promise<FreshwiseUserData> {
  const doc = await (await coll()).findOne({ _id: userId });
  if (!doc) return { prefs: DEFAULT_PREFS, basket: defaultBasket(), fresh: true };
  return {
    prefs: normalizePrefs(doc.prefs),
    // 沒有 basket 欄位＝這個帳號還沒存過菜籃，給預設的那幾樣；存過但是空的要尊重那個
    // 空的狀態，不然使用者清空菜籃之後預設項目又全部回來，看起來像刪不掉。
    basket: doc.basket ? normalizeBasket(doc.basket) : defaultBasket(),
    fresh: doc.basket === undefined && doc.prefs === undefined,
  };
}

export async function savePrefs(userId: string, prefs: unknown): Promise<FreshwisePrefs> {
  const next = normalizePrefs(prefs);
  await (await coll()).updateOne({ _id: userId }, { $set: { prefs: next, updatedAt: new Date() } }, { upsert: true });
  return next;
}

export async function saveBasket(userId: string, basket: unknown): Promise<BasketState> {
  const next = normalizeBasket(basket);
  await (await coll()).updateOne({ _id: userId }, { $set: { basket: next, updatedAt: new Date() } }, { upsert: true });
  return next;
}

/** 設定頁的「清除全部資料」。 */
export async function clearUserData(userId: string): Promise<void> {
  await (await coll()).deleteOne({ _id: userId });
}
