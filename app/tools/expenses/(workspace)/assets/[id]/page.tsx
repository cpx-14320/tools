import type { Metadata } from "next";
import { AccountDetailView } from "./account-detail-view";

export const metadata: Metadata = { title: "帳戶明細" };

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AccountDetailView accountId={id} />;
}
