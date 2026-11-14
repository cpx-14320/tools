import type { Metadata } from "next";
import { TrashView } from "./trash-view";
import { expensesUserId } from "@/lib/expenses/page-data.server";
import { listTrash } from "@/lib/expenses/trash.server";

export const metadata: Metadata = { title: "最近刪除" };
/** 垃圾桶的內容會被別的頁面改到（任何一頁刪東西都會長出新的一項），不能被快取住。 */
export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const userId = await expensesUserId();
  const items = await listTrash(userId);
  return <TrashView initialItems={items} />;
}
