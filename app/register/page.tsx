import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { RegisterView } from "./register-view";

export const metadata: Metadata = { title: "註冊" };

export default function RegisterPage() {
  return (
    <SiteShell>
      <RegisterView />
    </SiteShell>
  );
}
