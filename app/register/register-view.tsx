"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui";
import { AuthField, AuthPanel, AuthSwitchLink, authInputClass } from "@/components/auth-panel";

export function RegisterView() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, password, referralCode }),
      });
      const data: { error?: string } = await res.json();
      if (!res.ok) {
        setError(data.error ?? "註冊失敗，請再試一次");
        return;
      }
      await refresh();
      router.push("/");
    } catch {
      setError("連線失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPanel
      title="註冊帳號"
      description="註冊一次，底下的工具都能切換使用。"
      footer={
        <>
          已經有帳號了？ <AuthSwitchLink href="/login">登入</AuthSwitchLink>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthField label="名稱">
          <input type="text" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={authInputClass} />
        </AuthField>
        <AuthField label="帳號" hint="至少 3 個字元，之後用這組登入">
          <input
            type="text"
            required
            minLength={3}
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={authInputClass}
          />
        </AuthField>
        <AuthField label="密碼" hint="至少 8 個字元">
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass}
          />
        </AuthField>
        <AuthField label="推薦碼（選填）">
          <input
            type="text"
            autoComplete="off"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value)}
            className={authInputClass}
          />
        </AuthField>

        {/* 錯誤訊息做成一塊淡紅底的提示，不是一行小紅字——表單裡一行小字很容易被當成
            欄位說明忽略掉。 */}
        {error && (
          <p className="flex items-center gap-2 rounded-xl bg-negative-soft px-3 py-2.5 text-xs font-medium text-negative">
            <i aria-hidden className="fa-solid fa-circle-exclamation" />
            {error}
          </p>
        )}

        <Button type="submit" disabled={submitting} className="mt-1 w-full">
          {submitting ? "註冊中…" : "註冊"}
        </Button>
      </form>
    </AuthPanel>
  );
}
