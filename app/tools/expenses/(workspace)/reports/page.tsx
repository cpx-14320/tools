import type { Metadata } from "next";
import { PageHeader, Card, CardBody } from "@/components/ui";

export const metadata: Metadata = { title: "報表" };

export default function ReportsPage() {
  return (
    <div>
      <PageHeader title="報表" description="月度／年度趨勢圖表、分類佔比、收支比較" />
      <Card>
        <CardBody className="py-12 text-center">
          <p className="text-3xl">📈</p>
          <p className="mt-3 font-medium">開發順序排在第 5 階段</p>
          <p className="mt-1 text-sm text-muted">前面的消費紀錄、薪資紀錄都上線、資料量夠了之後再回來做趨勢圖表。</p>
        </CardBody>
      </Card>
    </div>
  );
}
