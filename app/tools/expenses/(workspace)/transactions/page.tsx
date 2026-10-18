import type { Metadata } from "next";
import { Suspense } from "react";
import { TransactionsView } from "./transactions-view";

export const metadata: Metadata = { title: "消費紀錄" };

/** TransactionsView 用 useSearchParams 讀 ?kind=收入（首頁「收入來源」的查看全部會帶過來），
 *  Next.js 要求用到 useSearchParams 的元件外面要包 Suspense，不然 build 時會報錯。 */
export default function TransactionsPage() {
  return (
    <Suspense fallback={null}>
      <TransactionsView />
    </Suspense>
  );
}
