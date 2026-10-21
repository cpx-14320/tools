import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import { buyFood, buyWearable, equipWearable, feedPet, settlePetRewards } from "@/lib/expenses/pet.server";
import { petItemById } from "@/lib/expenses/pet";

/** GET 會順便結算一次獎勵——養成頁本身就是使用者會回來看「我賺到幾顆星星幣」的地方，
 *  在這裡結算最直覺（layout 也會結算，兩邊都是冪等的，重複跑不會重複發）。
 *  今天的日期由前端傳，因為伺服器時區不一定跟使用者同一個。 */
export async function GET(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const { searchParams } = new URL(request.url);
  const today = searchParams.get("today") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return NextResponse.json({ error: "today 格式要是 YYYY-MM-DD" }, { status: 400 });

  const pet = await settlePetRewards(new ObjectId(user.id), today);
  return NextResponse.json({ pet });
}

export async function POST(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const action = body?.action;
  const itemId = typeof body?.itemId === "string" ? body.itemId : "";
  if (!itemId) return NextResponse.json({ error: "缺少 itemId" }, { status: 400 });

  const userId = new ObjectId(user.id);
  // 「買」這個動作食物跟服裝／背景是兩條不同的路：食物買了先進背包（buyFood），服裝跟
  // 背景買了直接換上（buyWearable）——由品項自己的 kind 決定要呼叫哪一個，前端不用分開傳。
  const item = petItemById(itemId);
  const result =
    action === "feed"
      ? await feedPet(userId, itemId)
      : action === "buy"
        ? item?.kind === "食物"
          ? await buyFood(userId, itemId)
          : await buyWearable(userId, itemId)
        : action === "equip"
          ? await equipWearable(userId, itemId)
          : { error: "action 只能是 feed、buy 或 equip" };

  if ("error" in result) return NextResponse.json(result, { status: 409 });
  return NextResponse.json({ pet: result });
}
