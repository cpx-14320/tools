import type { Metadata } from "next";
import { GoalsView } from "./goals-view";

export const metadata: Metadata = { title: "存錢目標" };

export default function GoalsPage() {
  return <GoalsView />;
}
