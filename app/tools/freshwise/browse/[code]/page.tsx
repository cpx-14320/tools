import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findItem } from "@/lib/freshwise/catalog";
import { todayISO } from "@/lib/freshwise/dates";
import { freshwisePrefs } from "@/lib/freshwise/page-data.server";
import { getItemDetail } from "@/lib/freshwise/prices.server";
import { ItemView } from "./item-view";

export const dynamic = "force-dynamic";

/** 分頁標題用品項名稱（「高麗菜 · cpx-tools」），不是固定的「品項詳情」——使用者同時開
 *  好幾個分頁比價時，標題是唯一分得出哪個分頁是哪一樣菜的地方。 */
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const item = findItem(code);
  return { title: item ? item.name : "品項詳情" };
}

export default async function FreshwiseItemPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const item = findItem(code);
  // 品項目錄是固定資料、不會被使用者刪掉，所以網址上的代碼不存在就只有一種可能——連結
  // 打錯或手改網址，那本來就該是 404。
  if (!item) notFound();

  const prefs = await freshwisePrefs();
  const today = todayISO();
  const detail = await getItemDetail(code, prefs.venue, today, prefs.marketCode);

  // detail 是 null 代表「這個品項在三個場所都沒有行情」——產季外的水果（11 月的荔枝）
  // 整段沒有交易就是這樣。這不是 404（品項存在、網址沒錯），所以照樣進頁面，由畫面說明
  // 現在沒有資料、產季是什麼時候。
  return <ItemView code={code} today={today} detail={detail} />;
}
