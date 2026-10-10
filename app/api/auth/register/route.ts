import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { ADMIN_REFERRAL_CODE, createUser, createSession, findUserByUsername } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const referralCode = typeof body?.referralCode === "string" ? body.referralCode.trim() : "";

  if (username.length < 3) {
    return NextResponse.json({ error: "帳號至少要 3 個字元" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "密碼至少要 8 個字元" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "請輸入名稱" }, { status: 400 });
  }

  if (await findUserByUsername(username)) {
    return NextResponse.json({ error: "這個帳號已經註冊過了" }, { status: 409 });
  }

  const isAdmin = referralCode === ADMIN_REFERRAL_CODE;
  const user = await createUser(username, password, name, isAdmin);
  await createSession(new ObjectId(user.id));
  return NextResponse.json({ user });
}
