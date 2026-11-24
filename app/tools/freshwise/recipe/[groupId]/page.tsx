import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { freshwisePageData } from "@/lib/freshwise/page-data.server";
import { groupsSorted } from "@/lib/freshwise/basket";
import { RecipeView } from "./recipe-view";

export const metadata: Metadata = { title: "食譜" };
export const dynamic = "force-dynamic";

/**
 * 一道菜的食譜頁。
 *
 * 食材不存在食譜裡——那是菜籃這個分類底下的項目，已經有品項、份量與今天的價格。
 * 這一頁把兩邊併起來：上面是「今天做這道菜要花多少錢」（菜籃算得出來），
 * 下面是「怎麼做、多少熱量」（食譜補的）。
 */
export default async function FreshwiseRecipePage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const { today, book, basket } = await freshwisePageData();
  // 菜籃是跟著帳號的，所以這裡就能決定這個分類存不存在——不用等瀏覽器掛載後再判斷，
  // 也就不會先閃一下空白頁再跳走。
  const group = basket ? groupsSorted(basket).find((g) => g.id === groupId) : undefined;
  if (!group) notFound();
  return <RecipeView today={today} book={book} groupId={groupId} />;
}
