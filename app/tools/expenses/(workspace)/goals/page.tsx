import type { Metadata } from "next";
import { GoalsView } from "./goals-view";
import { expensesUserId } from "@/lib/expenses/page-data.server";
import { listGoals } from "@/lib/expenses/goals.server";

export const metadata: Metadata = { title: "存錢目標" };

/** 資料在伺服器端讀好、跟著 HTML 一起送出，不是等瀏覽器拿到 JS 之後再打一輪 API。
 *
 *  以前是後者：HTML（空殼）→ 下載執行 JS → fetch → 才有畫面，三段瀑布疊起來進頁面要
 *  等六百多毫秒。伺服器到 MongoDB 的延遲遠低於「瀏覽器→伺服器→MongoDB」再繞回來。
 *
 *  force-dynamic：這一頁完全是使用者自己的資料，不能被 Next 當成靜態頁快取起來——
 *  不然新增／刪除之後按上一頁再回來，看到的會是舊的那份。 */
export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const goals = await listGoals(await expensesUserId());
  return <GoalsView initialGoals={goals} />;
}
