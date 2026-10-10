import type { Metadata } from "next";
import { PageHeader, Card, CardBody, Button, Badge } from "@/components/ui";
import { savingsGoals, goalProgress, memberName } from "@/lib/expenses/mock-data";
import { formatCurrency } from "@/lib/format";

export const metadata: Metadata = { title: "存錢目標" };

export default function GoalsPage() {
  return (
    <div>
      <PageHeader title="存錢目標" description="設定目標金額，追蹤存了多少、還差多少" actions={<Button>＋ 新增目標</Button>} />

      <div className="flex flex-col gap-4">
        {savingsGoals.map((goal) => {
          const { pct, remaining, achieved } = goalProgress(goal);
          return (
            <Card key={goal.id}>
              <CardBody>
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cat-c-bg text-xl">{goal.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{goal.name}</p>
                      {achieved && <Badge tone="positive">已達成</Badge>}
                      {goal.memberId && <Badge tone="neutral">{memberName(goal.memberId)}</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {goal.targetDate ? `目標日期 ${goal.targetDate}` : "沒有設定期限"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between">
                  <p className="text-xl font-bold tabular-nums">
                    {formatCurrency(goal.currentAmount)}
                    <span className="ml-1 text-sm font-normal text-muted">/ {formatCurrency(goal.targetAmount)}</span>
                  </p>
                  <p className="text-xs text-muted">{achieved ? "🎉 目標達成" : `還差 ${formatCurrency(remaining)}`}</p>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={`h-full rounded-full ${achieved ? "bg-positive" : "bg-brand"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-xs text-muted">{pct}%</p>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
