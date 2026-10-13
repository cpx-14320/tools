import type { Metadata } from "next";
import { AssetsView } from "./assets-view";

export const metadata: Metadata = { title: "資產總表" };

export default function AssetsPage() {
  return <AssetsView />;
}
