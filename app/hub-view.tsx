"use client";

import Link from "next/link";
import { Card, CardBody, Badge } from "@/components/ui";
import { useAuth } from "@/components/auth-provider";
import { TOOLS_REGISTRY } from "@/lib/tools-registry";

// toolsRegistry 本身沒有卡片用的顏色／簡介文字，這兩個維度跟權限（user.tools）無關，
// 純粹是顯示用，所以留在這個檔案裡依 toolId 另外配一份，不污染 tools-registry.ts。
const ICON_BG: Record<string, string> = {
  transit: "bg-cat-b-bg",
  expenses: "bg-cat-e-bg",
};

export function HubView() {
  const { user, loading } = useAuth();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">選一個工具開始</h1>
        <p className="mt-1 text-sm text-muted">登入一次，底下的工具都能切換使用。</p>
      </div>

      <div className="flex flex-col gap-3">
        {TOOLS_REGISTRY.map((tool) => {
          const hasAccess = !loading && (user?.tools ?? []).includes(tool.toolId);
          const iconBg = ICON_BG[tool.toolId] ?? "bg-surface-2";
          return hasAccess ? (
            <Link key={tool.toolId} href={tool.href} className="block">
              <Card className="transition-colors hover:border-brand">
                <CardBody className="flex items-center gap-4">
                  {tool.iconImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tool.iconImage} alt={tool.name} className="size-12 shrink-0 object-contain" />
                  ) : (
                    <span className={`grid size-12 shrink-0 place-items-center rounded-2xl text-2xl ${iconBg}`}>
                      {tool.icon}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{tool.name}</p>
                    <p className="mt-0.5 text-sm text-muted">{tool.description}</p>
                  </div>
                  <span aria-hidden className="shrink-0 text-muted">
                    ›
                  </span>
                </CardBody>
              </Card>
            </Link>
          ) : (
            <Card key={tool.toolId} className="opacity-70">
              <CardBody className="flex items-center gap-4">
                {tool.iconImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tool.iconImage} alt={tool.name} className="size-12 shrink-0 object-contain grayscale" />
                ) : (
                  <span className={`grid size-12 shrink-0 place-items-center rounded-2xl text-2xl grayscale ${iconBg}`}>
                    {tool.icon}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{tool.name}</p>
                  <p className="mt-0.5 text-sm text-muted">{tool.description}</p>
                </div>
                <Badge tone="future">需要權限</Badge>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
