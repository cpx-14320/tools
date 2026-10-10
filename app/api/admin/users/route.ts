import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listUsersForAdmin } from "@/lib/admin";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "請先登入" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "沒有管理權限" }, { status: 403 });

  const users = await listUsersForAdmin();
  return NextResponse.json({ users });
}
