import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { SiteShell } from "@/components/site-shell";
import { AdminView } from "./admin-view";

export const metadata = { title: "管理後台" };

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user?.isAdmin) redirect("/");

  return (
    <SiteShell>
      <AdminView />
    </SiteShell>
  );
}
