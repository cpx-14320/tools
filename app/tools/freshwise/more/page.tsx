import type { Metadata } from "next";
import { freshwisePrefs } from "@/lib/freshwise/page-data.server";
import { getPriceBook } from "@/lib/freshwise/prices.server";
import { todayISO } from "@/lib/freshwise/dates";
import { MoreView } from "./more-view";

export const metadata: Metadata = { title: "設定" };
export const dynamic = "force-dynamic";

export default async function FreshwiseMorePage() {
  const prefs = await freshwisePrefs();
  // 設定頁只需要市場清單與資料日期，不需要每個品項的報價；但市場清單是從實際資料長出來
  // 的（哪些市場今天真的有交易只有資料知道），所以還是走同一支 getPriceBook。
  const book = await getPriceBook(prefs.venue, todayISO(), prefs.marketCode);
  return <MoreView markets={book.markets} dataDate={book.dataDate} itemCount={Object.keys(book.quotes).length} />;
}
