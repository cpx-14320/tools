import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { HubShell } from "@/components/hub-shell";
import { AdminView } from "./admin-view";

export const metadata = { title: "管理後台" };

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user?.isAdmin) redirect("/");

  return (
    <HubShell>
      <AdminView />
    </HubShell>
  );
}
