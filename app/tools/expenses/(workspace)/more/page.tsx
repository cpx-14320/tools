import type { Metadata } from "next";
import { MoreView } from "./more-view";
import { expensesUserId } from "@/lib/expenses/page-data.server";
import { listPendingOccurrences } from "@/lib/expenses/recurring-rules.server";

export const metadata: Metadata = { title: "設定" };
/** 每次進頁都重新讀——到期的期數會隨時間長出來，而且清除資料後 router.refresh() 要能
 *  拿到歸零後的數字。 */
export const dynamic = "force-dynamic";

export default async function MorePage() {
  const pending = await listPendingOccurrences(await expensesUserId());
  return <MoreView pendingCount={pending.length} />;
}
