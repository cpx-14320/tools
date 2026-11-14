import type { Metadata } from "next";
import { AiDraftsView } from "./ai-drafts-view";
import { expensesUserId } from "@/lib/expenses/page-data.server";
import { listAiDrafts } from "@/lib/expenses/ai-drafts.server";

export const metadata: Metadata = { title: "待確認的解析結果" };
/** 解析結果是在別的畫面（首頁／明細頁的 AI 記帳）產生的，不能被快取住。 */
export const dynamic = "force-dynamic";

export default async function AiDraftsPage() {
  const userId = await expensesUserId();
  const drafts = await listAiDrafts(userId);
  return <AiDraftsView initialDrafts={drafts} />;
}
