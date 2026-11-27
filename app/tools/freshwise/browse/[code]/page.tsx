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

/**
 * 返回鍵要回哪裡。
 *
 * 同一個詳情頁有兩個入口：行情頁的清單，以及食譜裡的食材列。從食譜點進來、按返回卻跳到
 * 行情頁，使用者就得自己找回那道菜——所以食譜那邊的連結會帶 `?from=recipe-<分類 id>`。
 *
 * 網址是使用者改得到的，所以 `from` 一律驗格式再用（菜籃分類的 id 是 `g-xxx` 這種樣子，
 * 見 lib/freshwise/basket.ts 的 newId）。對不上就回行情頁——那是最沒有副作用的預設。
 */
function backTarget(from: string | undefined): { href: string; label: string } {
  const groupId = from?.startsWith("recipe-") ? from.slice("recipe-".length) : undefined;
  if (groupId && /^[A-Za-z0-9_-]{1,64}$/.test(groupId)) {
    return { href: `/tools/freshwise/recipe/${groupId}`, label: "回到食譜" };
  }
  return { href: "/tools/freshwise/browse", label: "回到行情" };
}

export default async function FreshwiseItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const [{ code }, { from }] = await Promise.all([params, searchParams]);
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
  return <ItemView code={code} today={today} detail={detail} back={backTarget(from)} />;
}
