"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/expenses/page-header";
import { Button, Badge, SegmentedControl } from "@/components/expenses/button";
import { Card, CardBody } from "@/components/expenses/card";
import { DeltaBadge } from "@/components/expenses/delta-badge";
import { DateField } from "@/components/expenses/date-field";
import { text } from "@/components/expenses/theme";
import { DateFilterPicker } from "@/components/expenses/date-filter-picker";
import { useDateFilter } from "@/components/expenses/date-filter-context";
import { SalaryTrendChart, type TrendSeries } from "@/components/expenses/salary-trend-chart";
import { SalaryRecordModal } from "@/components/expenses/salary-record-modal";
import { dateFilterRange } from "@/lib/expenses/date-filter";
import type { SalaryItemTypeDTO } from "@/lib/expenses/salary-types";
import {
  salaryNet,
  salaryRecordsInDateRange,
  salaryDelta,
  salaryCompareLabel,
  yearlySalaryTrend,
  type SalaryRecordDTO,
  type SalaryCompareSelection,
} from "@/lib/expenses/salary-records";
import { formatCurrency } from "@/lib/format";

const SERIES: TrendSeries[] = [{ id: "net", name: "薪資淨額", color: "#6F5FD6" }];

const COMPARE_OPTIONS: { value: SalaryCompareSelection["mode"]; label: string }[] = [
  { value: "prevMonth", label: "vs 上月" },
  { value: "lastYearSameMonth", label: "vs 去年同月" },
  { value: "custom", label: "自訂" },
];

type ModalState = { mode: "create" } | { mode: "edit"; record: SalaryRecordDTO };

export function SalaryView() {
  const { filter } = useDateFilter();
  const [records, setRecords] = useState<SalaryRecordDTO[]>([]);
  const [types, setTypes] = useState<SalaryItemTypeDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [compare, setCompare] = useState<SalaryCompareSelection>({ mode: "prevMonth" });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/expenses/salary-records").then((res) => res.json()),
      fetch("/api/expenses/salary-types").then((res) => res.json()),
    ])
      .then(([recordsData, typesData]: [{ records?: SalaryRecordDTO[] }, { types?: SalaryItemTypeDTO[] }]) => {
        if (cancelled) return;
        setRecords(recordsData.records ?? []);
        setTypes(typesData.types ?? []);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const range = dateFilterRange(filter);
  const isMonthMode = filter.mode === "month";
  const visibleRecords = [...salaryRecordsInDateRange(records, range)].sort((a, b) => (a.yearMonth < b.yearMonth ? 1 : -1));
  const trendData = yearlySalaryTrend(records, types, filter.year);

  async function handleSave(ym: string, items: { typeId: string; amount: number }[]) {
    if (!modal) return;
    if (modal.mode === "edit") {
      const data: { records?: SalaryRecordDTO[] } = await fetch("/api/expenses/salary-records", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: modal.record.id, items }),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (data.records) setRecords(data.records);
      setModal(null);
    } else {
      const data: { records?: SalaryRecordDTO[]; error?: string } = await fetch("/api/expenses/salary-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearMonth: ym, items }),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (data.records) {
        setRecords(data.records);
        setModal(null);
      } else if (data.error) {
        alert(data.error);
      }
    }
  }

  async function handleDelete() {
    if (modal?.mode !== "edit") return;
    const data: { records?: SalaryRecordDTO[] } = await fetch(`/api/expenses/salary-records?id=${modal.record.id}`, { method: "DELETE" })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.records) setRecords(data.records);
    setModal(null);
  }

  return (
    <div>
      <DateFilterPicker className="mb-4" />
      <PageHeader title="薪資紀錄" actions={<Button onClick={() => setModal({ mode: "create" })}>＋ 新增</Button>} />

      <SalaryRecordModal
        key={modal ? JSON.stringify(modal) : "closed"}
        open={modal !== null}
        types={types}
        initial={modal?.mode === "edit" ? modal.record : undefined}
        onClose={() => setModal(null)}
        onSave={handleSave}
        onDelete={modal?.mode === "edit" ? handleDelete : undefined}
      />

      {!ready ? (
        <p className={text.faint}>載入中…</p>
      ) : visibleRecords.length === 0 ? (
        <Card>
          <CardBody className={`py-10 text-center ${text.muted}`}>這段期間還沒有薪資紀錄。</CardBody>
        </Card>
      ) : isMonthMode ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 self-start">
            <SegmentedControl value={compare.mode} onChange={(mode) => setCompare({ mode })} options={COMPARE_OPTIONS} />
            {compare.mode === "custom" && (
              <DateField
                value={compare.customYearMonth ?? ""}
                onChange={(v) => setCompare({ mode: "custom", customYearMonth: v })}
                granularity="month"
                placeholder="選擇月份"
              />
            )}
          </div>

          {visibleRecords.map((r) => {
            const d = salaryDelta(records, types, r.yearMonth, compare);
            return (
              <Card key={r.id}>
                <CardBody>
                  <button type="button" onClick={() => setModal({ mode: "edit", record: r })} className="flex w-full items-center justify-between text-left">
                    <p className={text.sectionHeading}>{r.yearMonth}</p>
                    <div className="text-right">
                      <span className={`${text.statValue} text-[#2FAE82]`}>{formatCurrency(salaryNet(r, types))}</span>
                      {d && <DeltaBadge delta={d.delta} pct={d.pct} goodWhenUp className="mt-0.5" suffix={salaryCompareLabel(compare, d.compareYearMonth)} />}
                    </div>
                  </button>
                  <ul className="mt-3 flex flex-col divide-y divide-[#F2EEFA]">
                    {r.items.map((item, i) => {
                      const type = types.find((t) => t.id === item.typeId);
                      const isDeduction = type?.kind === "扣項";
                      return (
                        <li key={i} className="flex items-center justify-between py-2 text-sm">
                          <span className="flex items-center gap-2 text-[#4A3B7C]">
                            {type?.name ?? "（已刪除類型）"}
                            <Badge tone={isDeduction ? "negative" : "positive"}>{type?.kind}</Badge>
                          </span>
                          <span className="tabular-nums text-[#4A3B7C]">
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
        // 改列精簡的「月份 · 淨額」清單；要看某個月的明細加總，切回「月」模式即可。
        <Card>
          <div className="flex flex-col divide-y divide-[#F2EEFA]">
            {visibleRecords.map((r) => (
              <button key={r.id} type="button" onClick={() => setModal({ mode: "edit", record: r })} className="flex w-full items-center justify-between px-4 py-3 text-left">
                <p className={text.body}>{r.yearMonth}</p>
                <span className="tabular-nums font-semibold text-[#2FAE82]">{formatCurrency(salaryNet(r, types))}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card className="mt-4">
        <CardBody>
          <p className={text.sectionHeading}>{filter.year} 年度薪資趨勢</p>
          <div className="mt-4">
            <SalaryTrendChart data={trendData} series={SERIES} />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
