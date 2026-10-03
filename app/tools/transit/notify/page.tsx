import type { Metadata } from "next";
import { PageHeader, Card, CardBody, Badge, Button } from "@/components/ui";
import { notificationChannel } from "@/lib/transit-mock-data";

export const metadata: Metadata = { title: "通知設定" };

export default function NotifyPage() {
  return (
    <div>
      <PageHeader title="通知設定" description="誤點或即將到站時，推播到這裡設定的管道" />

      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Telegram</span>
              <Badge tone={notificationChannel.enabled ? "positive" : "neutral"}>
                {notificationChannel.enabled ? "已啟用" : "未啟用"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted">
              Chat ID <span className="font-mono">{notificationChannel.chatId}</span>
            </p>
          </div>
          <Button variant="secondary">{notificationChannel.enabled ? "重新綁定" : "開始綁定"}</Button>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <p className="font-semibold">如何綁定</p>
          <ol className="mt-3 flex flex-col gap-2 text-sm text-muted">
            <li>1. 在 Telegram 搜尋並開啟這個工具的機器人</li>
            <li>2. 傳送 <span className="font-mono text-ink">/start</span> 取得你的 Chat ID</li>
            <li>3. 回來這裡貼上 Chat ID 完成綁定</li>
          </ol>
          <p className="mt-3 text-xs text-muted">
            之前常見的 LINE Notify 已於 2025 年 3 月終止服務，改用 Telegram Bot 門檻較低，之後若需要可以再擴充其他管道。
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
