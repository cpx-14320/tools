import type { Metadata } from "next";
import { ImportView } from "./import-view";

export const metadata: Metadata = { title: "匯入資料" };

export default function ImportPage() {
  return <ImportView />;
}
