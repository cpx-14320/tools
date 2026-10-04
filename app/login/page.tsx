import type { Metadata } from "next";
import { HubShell } from "@/components/hub-shell";
import { LoginView } from "./login-view";

export const metadata: Metadata = { title: "登入" };

export default function LoginPage() {
  return (
    <HubShell>
      <LoginView />
    </HubShell>
  );
}
