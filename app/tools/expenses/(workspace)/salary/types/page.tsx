import type { Metadata } from "next";
import { PageHeader, Button, Badge } from "@/components/ui";
import { salaryItemTypes } from "@/lib/mock-data";

export const metadata: Metadata = { title: "薪資明細類型" };

export default function SalaryTypesPage() {
  return (
    <div>
      <PageHeader title="薪資明細類型" description="帳本共用，新增後在「薪資紀錄」就能選用" actions={<Button>＋ 新增</Button>} />

      <div className="flex flex-col divide-y divide-line overflow-hidden rounded-[1.5rem] border border-line bg-surface">
        {salaryItemTypes.map((t) => (
          <div key={t.id} className="flex items-center justify-between px-4 py-3.5">
            <span className="font-medium">{t.name}</span>
            <Badge tone={t.kind === "扣項" ? "negative" : "positive"}>{t.kind}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
