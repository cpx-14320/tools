import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSessionUser } from "@/lib/auth";
import { listMemos, syncMemos, type MemoInput } from "@/lib/memos";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "請先登入" }, { status: 401 });

  const memos = await listMemos(new ObjectId(user.id));
  return NextResponse.json({ memos });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "請先登入" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  const items: MemoInput[] = rawItems
    .map((item: { id?: unknown; content?: unknown; icon?: unknown; remindAt?: unknown }) => ({
      id: typeof item?.id === "string" ? item.id : undefined,
      content: typeof item?.content === "string" ? item.content.trim() : "",
      icon: typeof item?.icon === "string" ? item.icon : "",
      remindAt: typeof item?.remindAt === "string" && item.remindAt ? item.remindAt : null,
    }))
    .filter((item: MemoInput) => item.content);

  const memos = await syncMemos(new ObjectId(user.id), items);
  return NextResponse.json({ memos });
}
