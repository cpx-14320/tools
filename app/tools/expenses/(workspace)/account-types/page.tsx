import type { Metadata } from "next";
import { AccountTypesView } from "./account-types-view";

export const metadata: Metadata = { title: "帳戶類型" };

export default function AccountTypesPage() {
  return <AccountTypesView />;
}
