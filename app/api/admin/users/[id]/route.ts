import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSessionUser } from "@/lib/auth";
import { deleteUserCascade, updateUserTools } from "@/lib/admin";
import { TOOLS_REGISTRY } from "@/lib/tools-registry";

const VALID_TOOL_IDS = new Set(TOOLS_REGISTRY.map((t) => t.toolId));

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "請先登入" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "沒有管理權限" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const rawTools = Array.isArray(body?.tools) ? body.tools : null;
  if (!rawTools) return NextResponse.json({ error: "缺少 tools 清單" }, { status: 400 });

  const tools = rawTools.filter((t: unknown): t is string => typeof t === "string" && VALID_TOOL_IDS.has(t));
  await updateUserTools(new ObjectId(id), tools);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "請先登入" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "沒有管理權限" }, { status: 403 });

  const { id } = await params;
  if (id === user.id) return NextResponse.json({ error: "不能刪除自己目前登入的帳號" }, { status: 400 });

  await deleteUserCascade(new ObjectId(id));
  return NextResponse.json({ ok: true });
}
