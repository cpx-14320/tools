import type { Metadata } from "next";
import { CompanionView } from "./companion-view";
export const metadata: Metadata = { title: "我的蔬果夥伴" };
export default function CompanionPage() { return <CompanionView />; }
