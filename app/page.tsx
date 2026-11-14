import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { HubView } from "./hub-view";

export const metadata: Metadata = { title: "cpx-tools" };

export default function HomePage() {
  return (
    <SiteShell>
      <HubView />
    </SiteShell>
  );
}
