import type { Metadata } from "next";
import { RoutesView } from "./routes-view";

export const metadata: Metadata = { title: "監控路線" };

export default function RoutesPage() {
  return <RoutesView />;
}
