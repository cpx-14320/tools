import type { Metadata } from "next";
import { HubShell } from "@/components/hub-shell";
import { RegisterView } from "./register-view";

export const metadata: Metadata = { title: "註冊" };

export default function RegisterPage() {
  return (
    <HubShell>
      <RegisterView />
    </HubShell>
  );
}
