import type { Metadata } from "next";
import { freshwisePageData } from "@/lib/freshwise/page-data.server";
import { BasketView } from "./basket-view";

export const metadata: Metadata = { title: "我的菜籃" };
export const dynamic = "force-dynamic";

export default async function FreshwiseBasketPage() {
  // 菜籃的內容還在瀏覽器的 localStorage，所以這裡沒辦法只取「菜籃裡那幾樣」的價格——
  // 整本價格簿一起傳下去（九十幾個品項、不含各市場明細，約十幾 KB），client 再從裡面挑
  // 自己菜籃裡的那幾項。等菜籃搬進資料庫，這裡就可以只取需要的品項。
  const { today, book } = await freshwisePageData();
  return <BasketView today={today} book={book} />;
}
