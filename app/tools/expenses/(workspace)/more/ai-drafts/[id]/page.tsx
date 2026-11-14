import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AiDraftDetailView } from "./ai-draft-detail-view";
import { expensesUserId } from "@/lib/expenses/page-data.server";
import { getAiDraft } from "@/lib/expenses/ai-drafts.server";
import { listCategories } from "@/lib/expenses/categories.server";
import { listAccounts } from "@/lib/expenses/accounts.server";
import { listAccountTypes } from "@/lib/expenses/account-types.server";
import { listTransactions } from "@/lib/expenses/transactions.server";
import { listTransfers } from "@/lib/expenses/transfers.server";

export const metadata: Metadata = { title: "待確認" };
export const dynamic = "force-dynamic";

export default async function AiDraftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await expensesUserId();
  // 編輯一筆草稿用的是記帳本原本那個新增／編輯彈窗，它要帳戶、交易、轉帳（帳戶選擇
  // 要顯示餘額）。**這幾份只有這一頁需要**：以前整組掛在設定頁，為了不讓設定頁多載
  // 一份完整交易清單（量過大約 80KB），還得在瀏覽器端另外補抓一輪。變成獨立頁之後，
  // 需要的人自己在伺服器端讀好就行，設定頁一份都不用載。
  const [draft, categories, accounts, accountTypes, transactions, transfers] = await Promise.all([
    getAiDraft(userId, id),
    listCategories(userId),
    listAccounts(userId),
    listAccountTypes(userId),
    listTransactions(userId),
    listTransfers(userId),
  ]);
  // 找不到（網址亂打、或這一批剛剛在別的分頁被刪掉）就走 404，不要畫一頁空的詳情。
  if (!draft) notFound();

  return (
    <AiDraftDetailView
      initialDraft={draft}
      initialCategories={categories}
      accounts={accounts}
      accountTypes={accountTypes}
      transactions={transactions}
      transfers={transfers}
    />
  );
}
