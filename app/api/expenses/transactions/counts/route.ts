import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireTool } from "@/lib/auth";
import { countByCategory } from "@/lib/expenses/transactions.server";

export async function GET() {
  const user = await requireTool("expenses");
  if (user instanceof NextResponse) return user;

  const counts = await countByCategory(new ObjectId(user.id));
  return NextResponse.json({ counts });
}
