"use client";

import Link from "next/link";
import { Card, CardBody, Badge } from "@/components/ui";

const tools = [
  {
    name: "搭乘車查詢",
    desc: "查固定通勤班次時刻表，誤點或即將到站時推播提醒。",
    icon: "🚌",
    iconBg: "bg-cat-b-bg",
    href: "/tools/transit",
    status: "active" as const,
  },
  {
    name: "記帳本",
    desc: "記錄家庭收支、拆分帳本成員，追蹤每月預算跟存錢目標。",
    icon: "💰",
    iconBg: "bg-cat-e-bg",
    href: "/tools/expenses",
    status: "active" as const,
  },
];

export function HubView() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">選一個工具開始</h1>
        <p className="mt-1 text-sm text-muted">登入一次，底下的工具都能切換使用。</p>
      </div>

      <div className="flex flex-col gap-3">
        {tools.map((tool) =>
          tool.href ? (
            <Link key={tool.name} href={tool.href} className="block">
              <Card className="transition-colors hover:border-brand">
                <CardBody className="flex items-center gap-4">
                  <span className={`grid size-12 shrink-0 place-items-center rounded-2xl text-2xl ${tool.iconBg}`}>
                    {tool.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{tool.name}</p>
                    <p className="mt-0.5 text-sm text-muted">{tool.desc}</p>
                  </div>
                  <span aria-hidden className="shrink-0 text-muted">
                    ›
                  </span>
                </CardBody>
              </Card>
            </Link>
          ) : (
            <Card key={tool.name} className="opacity-70">
              <CardBody className="flex items-center gap-4">
                <span className={`grid size-12 shrink-0 place-items-center rounded-2xl text-2xl grayscale ${tool.iconBg}`}>
                  {tool.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{tool.name}</p>
                  <p className="mt-0.5 text-sm text-muted">{tool.desc}</p>
                </div>
                <Badge tone="future">尚未推出</Badge>
              </CardBody>
            </Card>
          ),
        )}
      </div>
    </div>
  );
}
