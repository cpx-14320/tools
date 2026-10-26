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

/** 連買 count 份食物。
 *
 *  一份一份呼叫 buyFood（它本身是原子的「錢夠才扣」），不是先算總價再一次扣：中途星星幣
 *  不夠時前面已經買到的那幾份算數、後面停下來，回傳的是當下真正的狀態。第一份就買不起
 *  才回報錯誤。 */
async function buyFoodBatch(userId: ObjectId, itemId: string, count: number) {
  let last = await buyFood(userId, itemId);
  if ("error" in last) return last;
  for (let i = 1; i < count; i++) {
    const next = await buyFood(userId, itemId);
    if ("error" in next) break;
    last = next;
  }
  return last;
}

export async function POST(request: Request) {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => null);
  const action = body?.action;
  const itemId = typeof body?.itemId === "string" ? body.itemId : "";
  if (!itemId) return NextResponse.json({ error: "缺少 itemId" }, { status: 400 });

  const userId = new ObjectId(user.id);
  // 食物可以一次買好幾份（商店的數量選擇器）。上限 99 是防呆，不是遊戲規則——沒有上限的話
  // 一個打錯的數字就會把星星幣全部花光。服裝／背景本來就只能有一份，忽略 count。
  const count = Math.min(99, Math.max(1, Math.floor(Number(body?.count) || 1)));
  // 「買」這個動作食物跟服裝／背景是兩條不同的路：食物買了先進背包（buyFood），服裝跟
  // 背景買了直接換上（buyWearable）——由品項自己的 kind 決定要呼叫哪一個，前端不用分開傳。
  const item = petItemById(itemId);
  const result =
    action === "feed"
      ? await feedPet(userId, itemId)
      : action === "buy"
        ? item?.kind === "食物"
          ? await buyFoodBatch(userId, itemId, count)
          : await buyWearable(userId, itemId)
        : action === "equip"
          ? await equipWearable(userId, itemId)
          : { error: "action 只能是 feed、buy 或 equip" };

  if ("error" in result) return NextResponse.json(result, { status: 409 });
  return NextResponse.json({ pet: result });
}
