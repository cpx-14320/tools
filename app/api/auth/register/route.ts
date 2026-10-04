import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { createUser, createSession, findUserByEmail } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "請輸入正確的 Email 格式" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "密碼至少要 8 個字元" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "請輸入名稱" }, { status: 400 });
  }

  if (await findUserByEmail(email)) {
    return NextResponse.json({ error: "這個 Email 已經註冊過了" }, { status: 409 });
  }

  const user = await createUser(email, password, name);
  await createSession(new ObjectId(user.id));
  return NextResponse.json({ user });
}
