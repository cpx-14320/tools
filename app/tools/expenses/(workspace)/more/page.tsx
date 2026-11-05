import type { Metadata } from "next";
import { MoreView } from "./more-view";
import { expensesUserId } from "@/lib/expenses/page-data.server";
import { listPendingOccurrences } from "@/lib/expenses/recurring-rules.server";
import { getExpensesSettings } from "@/lib/expenses/settings.server";
import { listAiDrafts } from "@/lib/expenses/ai-drafts.server";
import { listTrash } from "@/lib/expenses/trash.server";
import { listCategories } from "@/lib/expenses/categories.server";

export const metadata: Metadata = { title: "設定" };
/** 每次進頁都重新讀——到期的期數會隨時間長出來，而且清除資料後 router.refresh() 要能
 *  拿到歸零後的數字。 */
export const dynamic = "force-dynamic";

export default async function MorePage() {
  const userId = await expensesUserId();
  const [pending, settings, aiDrafts, categories, trash] = await Promise.all([
    listPendingOccurrences(userId),
    getExpensesSettings(userId),
    listAiDrafts(userId),
    listCategories(userId),
    listTrash(userId),
  ]);
  return (
    <MoreView pendingCount={pending.length} aiEnabled={settings.aiEnabled} aiDrafts={aiDrafts} categories={categories} trash={trash} />
  );
}
