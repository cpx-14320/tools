import type { Metadata } from "next";
import { CATEGORIES } from "@/lib/freshwise/catalog";
import { freshwisePageData } from "@/lib/freshwise/page-data.server";
import type { CategoryKey } from "@/lib/freshwise/types";
import { BrowseView } from "./browse-view";

export const metadata: Metadata = { title: "行情" };
export const dynamic = "force-dynamic";

const VALID_CATEGORIES = new Set(CATEGORIES.map((c) => c.key));

/**
 * 行情頁。
 *
 * 搜尋關鍵字與分類從網址讀（首頁的搜尋框與分類快捷都是連過來的），但是在**伺服器端**
 * 讀、再當 props 傳下去，不是在 client 元件裡用 useSearchParams——後者需要在外面包一層
 * Suspense，而這一頁的初始內容本來就要靠網址才能決定，包 Suspense 只會先閃一次空清單。
 */
export default async function FreshwiseBrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const [{ q, category }, { today, book }] = await Promise.all([searchParams, freshwisePageData()]);
  // 網址是使用者改得到的，分類一律驗證過才用，不然 category=xxx 會變成一個選不掉的空
  // 清單（沒有任何品項屬於那個分類，但分頁上也看不出哪一個被選中）。
  const initialCategory = category && VALID_CATEGORIES.has(category as CategoryKey) ? (category as CategoryKey) : "";
  return <BrowseView today={today} book={book} initialKeyword={q ?? ""} initialCategory={initialCategory} />;
}
