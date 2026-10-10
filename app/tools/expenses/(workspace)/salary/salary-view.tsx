"use client";

import { PageHeader, Button, Card, CardBody, Badge, DeltaBadge } from "@/components/ui";
import { DateFilterPicker } from "@/components/expenses/date-filter-picker";
import { useDateFilter } from "@/components/expenses/date-filter-context";
import { SalaryTrendChart, type TrendSeries } from "@/components/expenses/salary-trend-chart";
import {
  salaryItemTypeById,
  memberName,
  members,
  salaryNet,
  monthOverMonthDelta,
  yearlySalaryTrend,
  dateFilterRange,
  referenceYearMonth,
  salaryRecordsInDateRange,
} from "@/lib/expenses/mock-data";
import { formatCurrency } from "@/lib/format";

const MEMBER_SERIES: TrendSeries[] = [
  { id: "m1", name: memberName("m1"), color: "var(--cat-c-fg)" },
  { id: "m2", name: memberName("m2"), color: "var(--cat-a-fg)" },
];

export function SalaryView() {
  const { filter } = useDateFilter();
  const range = dateFilterRange(filter);
  const isMonthMode = filter.mode === "month";
  const yearMonth = referenceYearMonth(filter);
  const records = [...salaryRecordsInDateRange(range)].sort((a, b) =>
    a.yearMonth === b.yearMonth ? a.memberId.localeCompare(b.memberId) : a.yearMonth < b.yearMonth ? -1 : 1,
  );
  const trendData = yearlySalaryTrend(filter.year);

  return (
    <div>
      <DateFilterPicker className="mb-4" />
      <PageHeader title="薪資紀錄" description="帳本全員可見" actions={<Button>＋ 新增</Button>} />

      {records.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-center text-sm text-muted">這段期間還沒有薪資紀錄。</CardBody>
        </Card>
      ) : isMonthMode ? (
        <div className="flex flex-col gap-4">
          {records.map((r) => {
            const mom = monthOverMonthDelta(r.memberId, yearMonth);
            return (
              <Card key={r.id}>
                <CardBody>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{memberName(r.memberId)}</p>
                    <div className="text-right">
                      <span className="tabular-nums text-lg font-bold text-positive">{formatCurrency(salaryNet(r))}</span>
                      {mom && <DeltaBadge delta={mom.delta} pct={mom.pct} goodWhenUp className="mt-0.5" />}
                    </div>
                  </div>
                  <ul className="mt-3 flex flex-col divide-y divide-line">
                    {r.items.map((item, i) => {
                      const type = salaryItemTypeById(item.typeId);
                      const isDeduction = type?.kind === "扣項";
                      return (
                        <li key={i} className="flex items-center justify-between py-2 text-sm">
                          <span className="flex items-center gap-2">
                            {type?.name ?? "（已刪除類型）"}
                            <Badge tone={isDeduction ? "negative" : "positive"}>{type?.kind}</Badge>
                          </span>
                          <span className="tabular-nums">
                            {isDeduction ? "－" : "＋"}
                            {formatCurrency(item.amount)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </CardBody>
              </Card>
            );
          })}
        </div>
      ) : (
        // 非「月」模式（年／日／全部／自訂）涵蓋的月份可能不只一個，itemized 卡片會太長，
        // 改列精簡的「月份 · 成員 · 淨額」清單；要看某個月的明細加總，切回「月」模式即可。
        <div className="flex flex-col divide-y divide-line overflow-hidden rounded-[1.5rem] border border-line bg-surface">
          {records.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium">{memberName(r.memberId)}</p>
                <p className="text-xs text-muted">{r.yearMonth}</p>
              </div>
              <span className="tabular-nums font-semibold text-positive">{formatCurrency(salaryNet(r))}</span>
            </div>
          ))}
        </div>
      )}

      <Card className="mt-4">
        <CardBody>
          <p className="font-semibold">{filter.year} 年度薪資趨勢</p>
          <p className="mt-0.5 text-xs text-muted">每位成員每月淨額，{members.length < 2 ? "" : "拖曳／點選月份比較"}</p>
          <div className="mt-4">
            <SalaryTrendChart data={trendData} series={MEMBER_SERIES} />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
