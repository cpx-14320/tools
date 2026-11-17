import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { SiteShell } from "@/components/site-shell";
import { AdminView } from "./admin-view";

export const metadata = { title: "管理後台" };

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user?.isAdmin) redirect("/");

  // back：頁首左上角換成「工具列表」返回鍵（取代品牌標記）。這一頁是從首頁的「帳號」區
  // 點進來的二層頁面，出口不該只有「把網址列的 /admin 刪掉」。
  return (
    <SiteShell back={{ href: "/", label: "工具列表" }} title="管理後台">
      <AdminView />
    </SiteShell>
  );
}
