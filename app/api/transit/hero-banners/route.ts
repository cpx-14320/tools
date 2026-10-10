import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSessionUser } from "@/lib/auth";
import { listHeroBanners, syncHeroBanners, type HeroBannerInput } from "@/lib/transit/hero-banners";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "請先登入" }, { status: 401 });

  const items = await listHeroBanners(new ObjectId(user.id));
  return NextResponse.json({ items });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "請先登入" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  const items: HeroBannerInput[] = rawItems
    .map((item: { id?: unknown; title?: unknown; caption?: unknown; image?: unknown }) => ({
      id: typeof item?.id === "string" ? item.id : undefined,
      title: typeof item?.title === "string" ? item.title.trim() : "",
      caption: typeof item?.caption === "string" ? item.caption.trim() : "",
      image: typeof item?.image === "string" ? item.image.trim() : "",
    }))
    .filter((item: HeroBannerInput) => item.title && item.caption && item.image);

  const result = await syncHeroBanners(new ObjectId(user.id), items);
  return NextResponse.json({ items: result });
}
