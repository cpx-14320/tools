import { NextResponse } from "next/server";
import { findUserByEmail, verifyPassword, createSession, toSessionUser } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const user = email ? await findUserByEmail(email) : null;
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    return NextResponse.json({ error: "帳號或密碼錯誤" }, { status: 401 });
  }

  await createSession(user._id);
  return NextResponse.json({ user: toSessionUser(user) });
}
