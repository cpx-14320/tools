import type { Metadata } from "next";
import { MoreView } from "./more-view";

export const metadata: Metadata = { title: "設定" };

export default function MorePage() {
  return <MoreView />;
}
