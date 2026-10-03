import type { Metadata } from "next";
import { PageHeader, Card, CardBody, Badge, Button } from "@/components/ui";
import { ledger, members } from "@/lib/mock-data";

export const metadata: Metadata = { title: "成員" };

export default function MembersPage() {
  return (
    <div>
      <PageHeader title="成員" description={ledger.name} />

      <Card className="mb-5">
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted">邀請碼</p>
            <p className="mt-0.5 font-mono text-lg font-semibold tracking-wide">{ledger.inviteCode}</p>
          </div>
          <Button variant="secondary">重新產生邀請碼</Button>
        </CardBody>
      </Card>

      <div className="flex flex-col divide-y divide-line rounded-[1.5rem] border border-line bg-surface">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
                {m.name.slice(0, 1)}
              </span>
              <span className="font-medium">{m.name}</span>
              <Badge tone={m.role === "owner" ? "brand" : "neutral"}>{m.role === "owner" ? "擁有者" : "成員"}</Badge>
            </div>
            {m.role !== "owner" && (
              <Button variant="ghost" className="text-negative hover:text-negative">
                移除
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
