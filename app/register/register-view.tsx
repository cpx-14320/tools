"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Card, CardBody, Button } from "@/components/ui";

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
    <div className="mx-auto max-w-sm">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold tracking-tight">註冊帳號</h1>
        <p className="mt-1 text-sm text-muted">註冊一次，底下的工具都能切換使用。</p>
      </div>

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">名稱</span>
              <input
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">帳號</span>
              <input
                type="text"
                required
                minLength={3}
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">密碼</span>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand"
              />
              <span className="text-xs text-muted">至少 8 個字元</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">推薦碼（選填）</span>
              <input
                type="text"
                autoComplete="off"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand"
              />
            </label>

            {error && <p className="text-xs text-negative">{error}</p>}

            <Button type="submit" disabled={submitting} className="mt-1 w-full">
              {submitting ? "註冊中…" : "註冊"}
            </Button>
          </form>
        </CardBody>
      </Card>

      <p className="mt-4 text-center text-sm text-muted">
        已經有帳號了？{" "}
        <Link href="/login" className="font-medium text-brand">
          登入
        </Link>
      </p>
    </div>
  );
}
