import type { Metadata } from "next";
import { AiDraftsView } from "./ai-drafts-view";
import { expensesUserId } from "@/lib/expenses/page-data.server";
import { deleteEmptyAiDrafts, listAiDrafts } from "@/lib/expenses/ai-drafts.server";

export const metadata: Metadata = { title: "待確認的解析結果" };
/** 解析結果是在別的畫面（首頁／明細頁的 AI 記帳）產生的，不能被快取住。 */
export const dynamic = "force-dynamic";

export default async function AiDraftsPage() {
  const userId = await expensesUserId();
  // 先掃掉「每一筆都被略過」的空批次再列：那種批次畫面上看不到、卻一直留在資料庫裡
  // （見 deleteEmptyAiDrafts）。現在略過最後一筆時就會刪，這一行是補刪以前留下來的。
  await deleteEmptyAiDrafts(userId);
  const drafts = await listAiDrafts(userId);
  return <AiDraftsView initialDrafts={drafts} />;
}
