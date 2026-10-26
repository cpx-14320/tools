import type { ReactNode } from "react";
import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import { getSessionUser, hasToolAccess } from "@/lib/auth";
import { ToolAccessDenied } from "@/components/tool-access-denied";
import { seedExpensesPresets } from "@/lib/expenses/presets.server";
import { settlePetRewards } from "@/lib/expenses/pet.server";

/** 包住 (workspace) 底下所有頁面跟 ledgers/page.tsx——兩邊都屬於「記帳本」這個工具，
 *  在這一層統一檔，不用在 (workspace)/layout.tsx 跟 ledgers 各自重複檢查一次。
 *
 *  固定收支本來在這裡自動入帳，已經移除：「固定」收支其實沒那麼固定（電話費每個月
 *  金額不一樣、某個月根本沒扣款），自動寫進去會默默生出跟實際不符的紀錄。改成到期的
 *  那幾期列在固定收支頁的「待確認」區，使用者按確認才入帳（見 listPendingOccurrences）。 */
export default async function ExpensesToolLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!hasToolAccess(user, "expenses")) return <ToolAccessDenied toolName="記帳本" />;
  // 第一次進來就要看得到預設的分類／帳戶。盡力而為，失敗不擋頁面渲染。
  const userId = new ObjectId(user.id);
  await seedExpensesPresets(userId).catch(() => {});
  // 養成的星星幣結算也掛在這裡：使用者可能先記完帳就離開、沒進養成頁，獎勵還是要算到。
  // 伺服器時區不一定跟使用者同一個，這裡用伺服器的今天就好——差一天的邊界情況由養成頁
  // 自己再結算一次（兩邊都是冪等的，同一筆獎勵只會發一次）。
  const serverToday = new Date();
  const todayISO = `${serverToday.getFullYear()}-${String(serverToday.getMonth() + 1).padStart(2, "0")}-${String(serverToday.getDate()).padStart(2, "0")}`;
  await settlePetRewards(userId, todayISO).catch(() => {});
  return children;
}
