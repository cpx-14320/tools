import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { getDb } from "./mongodb";

export const SESSION_COOKIE = "cpx_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

// 註冊時輸入這個推薦碼，帳號會直接拿到管理者權限——目前朋友圈在用，先用這個簡單的
// 共用碼頂著，還沒有「申請後人工審核」那套流程。
export const ADMIN_REFERRAL_CODE = "SW01256";

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  tools: string[];
  isAdmin: boolean;
}

export interface UserDoc {
  _id: ObjectId;
  username: string;
  passwordHash: string;
  name: string;
  tools: string[];
  isAdmin: boolean;
}

interface SessionDoc {
  _id: string;
  userId: ObjectId;
  expiresAt: Date;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function toSessionUser(user: UserDoc): SessionUser {
  return { id: user._id.toHexString(), username: user.username, name: user.name, tools: user.tools, isAdmin: !!user.isAdmin };
}

/** 建立一筆 session 資料並把對應的 cookie 寫進回應裡，session token 是隨機字串，
 *  不是 JWT——每次要驗證都直接查 sessions collection，之後要讓某個 session 失效
 *  （例如使用者改密碼、被停權）直接刪那筆文件就生效，不用額外搞黑名單。 */
export async function createSession(userId: ObjectId): Promise<void> {
  const db = await getDb();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.collection<SessionDoc>("sessions").insertOne({ _id: token, userId, expiresAt });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.collection<SessionDoc>("sessions").deleteOne({ _id: token });
  }
  cookieStore.delete(SESSION_COOKIE);
}

/** 讀目前請求的 session cookie，查出對應的使用者；沒登入或 session 過期都回傳 null。
 *  sessions 的過期靠 TTL index 自動清掉（見 lib/mongodb.ts），這裡只是讀不到就當作沒登入。 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = await getDb();
  const session = await db.collection<SessionDoc>("sessions").findOne({ _id: token });
  if (!session) return null;

  const user = await db.collection<UserDoc>("users").findOne({ _id: session.userId });
  if (!user) return null;

  return toSessionUser(user);
}

export async function findUserByUsername(username: string) {
  const db = await getDb();
  return db.collection<UserDoc>("users").findOne({ username });
}

/** 新註冊的使用者預設拿到目前 toolsRegistry 裡所有工具的權限——這個小工具包目前
 *  是朋友／自己人在用，還沒有「申請權限才能用」的審核流程，先用這個簡單預設值。
 *  isAdmin 由註冊表單是否填對推薦碼（ADMIN_REFERRAL_CODE）決定，不是這裡自己判斷。 */
export async function createUser(username: string, password: string, name: string, isAdmin: boolean): Promise<SessionUser> {
  const db = await getDb();
  const tools = await db.collection("toolsRegistry").find().map((t) => t.toolId as string).toArray();
  const passwordHash = await hashPassword(password);
  const result = await db.collection<UserDoc>("users").insertOne({ username, passwordHash, name, tools, isAdmin } as UserDoc);
  return { id: result.insertedId.toHexString(), username, name, tools, isAdmin };
}
