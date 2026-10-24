import type { Metadata } from "next";
import { DataView } from "./data-view";

export const metadata: Metadata = { title: "匯出／匯入資料" };

export default function DataPage() {
  return <DataView />;
}
