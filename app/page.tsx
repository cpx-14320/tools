import type { Metadata } from "next";
import { HubShell } from "@/components/hub-shell";
import { HubView } from "./hub-view";

export const metadata: Metadata = { title: "cpx-tools" };

export default function HomePage() {
  return (
    <HubShell>
      <HubView />
    </HubShell>
  );
}
