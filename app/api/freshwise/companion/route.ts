import { NextResponse } from "next/server";
import { requireTool } from "@/lib/auth";
import { applyCompanionAction, loadCompanion, migrateCompanionFromDevice, redeemCompanionCode, CompanionCodeError, type CompanionAction } from "@/lib/freshwise/companions.server";
import { COMPANIONS, QUESTS, type CompanionEvent, type LookChoice } from "@/lib/freshwise/companions";

// 夥伴養成的進度。跟著帳號走（見 lib/freshwise/companions.server.ts 的說明）。
//
// 「今天是幾號」由前端傳：伺服器在 Vercel 上是 UTC，台灣時間凌晨 0～8 點會算成昨天，
// 任務就會在錯的時間重置。格式先擋掉，不要把使用者傳什麼就當什麼用。
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function dayOf(value: unknown): string | null {
  return typeof value === "string" && DAY.test(value) ? value : null;
}

export async function GET(request: Request) {
  const user = await requireTool("freshwise");
  if (user instanceof NextResponse) return user;

  const day = dayOf(new URL(request.url).searchParams.get("today"));
  if (!day) return NextResponse.json({ error: "today 格式要是 YYYY-MM-DD" }, { status: 400 });

  return NextResponse.json({ state: await loadCompanion(user.id, day) });
}

/** 前端送的是「發生了什麼事」，不是「新的狀態」——狀態一律由伺服器用同一組純函式算出來。 */
function parseAction(body: Record<string, unknown>): CompanionAction | null {
  switch (body.action) {
    case "events": {
      if (!Array.isArray(body.events)) return null;
      const events: CompanionEvent[] = [];
      for (const raw of body.events) {
        if (!raw || typeof raw !== "object") continue;
        const e = raw as Record<string, unknown>;
        if (e.type === "view" && typeof e.code === "string" && /^[A-Z0-9]{2,12}$/.test(e.code)) events.push({ type: "view", code: e.code });
        else if (e.type === "chart") events.push({ type: "chart" });
        else if (e.type === "basket") events.push({ type: "basket" });
      }
      return events.length ? { kind: "events", events } : null;
    }
    case "claim": {
      const quest = QUESTS.find((q) => q.id === body.quest)?.id;
      return quest ? { kind: "claim", quest } : null;
    }
    case "care":
      return body.care === "water" || body.care === "play" ? { kind: "care", action: body.care } : null;
    case "select": {
      const id = COMPANIONS.find((p) => p.id === body.id)?.id;
      return id ? { kind: "select", id } : null;
    }
    case "look": {
      // 外觀階段：0＝跟等級走、1～3＝固定用那一階。能不能挑（夥伴解鎖了嗎、長到那一階了嗎）
      // 由 chooseCompanionLook 判斷，這裡只負責把格式擋在門外。
      const id = COMPANIONS.find((p) => p.id === body.id)?.id;
      const look = [0, 1, 2, 3].includes(body.look as number) ? (body.look as LookChoice) : null;
      return id && look !== null ? { kind: "look", id, look } : null;
    }
    case "reset":
      return { kind: "reset" };
    default:
      return null;
  }
}

export async function POST(request: Request) {
  const user = await requireTool("freshwise");
  if (user instanceof NextResponse) return user;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });

  const day = dayOf(body.today);
  if (!day) return NextResponse.json({ error: "today 格式要是 YYYY-MM-DD" }, { status: 400 });

  // 從 localStorage 搬家：只有在雲端完全沒有進度時才會被接受。
  if (body.action === "migrate") {
    if (typeof body.raw !== "string") return NextResponse.json({ error: "缺少 raw" }, { status: 400 });
    return NextResponse.json({ state: await migrateCompanionFromDevice(user.id, body.raw, day) });
  }

  if (body.action === "redeem") {
    try {
      return NextResponse.json(await redeemCompanionCode(user.id, body.code, day));
    } catch (error) {
      if (!(error instanceof CompanionCodeError)) throw error;
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  const action = parseAction(body);
  if (!action) return NextResponse.json({ error: "action 不合法" }, { status: 400 });

  return NextResponse.json({ state: await applyCompanionAction(user.id, action, day) });
}
