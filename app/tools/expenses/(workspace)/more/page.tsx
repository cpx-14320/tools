import type { Metadata } from "next";
import { MoreView } from "./more-view";
import { expensesUserId } from "@/lib/expenses/page-data.server";
import { listPendingOccurrences } from "@/lib/expenses/recurring-rules.server";
import { getExpensesSettings } from "@/lib/expenses/settings.server";
import { listAiDrafts } from "@/lib/expenses/ai-drafts.server";
import { countTrash } from "@/lib/expenses/trash.server";
import { pendingItems } from "@/lib/expenses/ai-drafts";

export const metadata: Metadata = { title: "設定" };
/** 每次進頁都重新讀——到期的期數會隨時間長出來，而且清除資料後 router.refresh() 要能
 *  拿到歸零後的數字。 */
export const dynamic = "force-dynamic";

/** 這一頁只需要「有幾項」：最近刪除跟待確認的解析結果都已經是獨立頁面
 *  （/more/trash、/more/ai-drafts），各自在自己的 page.tsx 讀自己的資料。設定頁這邊
 *  讀的是掛在那兩列右邊的數字徽章，整包清單不用再跟著進這一頁的 payload。 */
export default async function MorePage() {
  const userId = await expensesUserId();
  const [pending, settings, aiDrafts, trashCount] = await Promise.all([
    listPendingOccurrences(userId),
    getExpensesSettings(userId),
    listAiDrafts(userId),
    countTrash(userId),
  ]);
  // 只數「還沒處理完」的批次，跟待確認頁列出來的那幾批同一條規則。
  const aiDraftCount = aiDrafts.filter((d) => d.status === "pending" && pendingItems(d).length > 0).length;
  return <MoreView pendingCount={pending.length} aiEnabled={settings.aiEnabled} aiDraftCount={aiDraftCount} trashCount={trashCount} />;
}
