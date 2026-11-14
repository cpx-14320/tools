import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { LoginView } from "./login-view";

export const metadata: Metadata = { title: "登入" };

export default function LoginPage() {
  return (
    <SiteShell>
      <LoginView />
    </SiteShell>
  );
}
