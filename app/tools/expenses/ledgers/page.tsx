import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardBody, Button } from "@/components/ui";
import { LedgerIllustration } from "@/components/expenses/illustrations";

export const metadata: Metadata = { title: "選擇帳本" };

export default function LedgersPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-bg px-6 py-10">
      <Link href="/" className="text-xs font-medium text-muted hover:text-ink">
        ← cpx-tools
      </Link>

      <LedgerIllustration className="mx-auto h-40 w-full max-w-xs" />

      <div className="text-center">
        <h1 className="text-xl font-bold tracking-tight">記帳本</h1>
        <p className="mt-1 text-sm text-muted">建立新帳本，或輸入邀請碼加入既有帳本。</p>
      </div>

      <Card>
        <CardBody className="flex flex-col gap-3">
          <p className="font-semibold">建立帳本</p>
          <input
            className="rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand"
            placeholder="帳本名稱，例如「我們家的帳本」"
          />
          <Button className="self-start">建立</Button>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-3">
          <p className="font-semibold">加入帳本</p>
          <input
            className="rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-mono outline-none focus:border-brand"
            placeholder="輸入邀請碼"
          />
          <Button variant="secondary" className="self-start">
            加入
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
