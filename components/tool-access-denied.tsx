import { Card, CardBody, ButtonLink } from "@/components/ui";
import { HubShell } from "@/components/hub-shell";

/** 所有工具共用的「無權限瀏覽」畫面——使用者已登入，但目前這個帳號沒有被勾選這個工具的
 *  使用權限（見 lib/auth.ts 的 hasToolAccess）。用 HubShell 包起來，不要套任何特定工具的
 *  殼（TransitShell／ExpensesShell），因為使用者本來就進不去那個工具，不該看到它的介面。 */
export function ToolAccessDenied({ toolName }: { toolName: string }) {
  return (
    <HubShell>
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="text-4xl">🔒</span>
        <div>
          <h1 className="text-lg font-bold tracking-tight">無權限瀏覽</h1>
          <p className="mt-1 text-sm text-muted">你的帳號目前沒有「{toolName}」的使用權限，請聯絡管理者開通。</p>
        </div>
        <Card className="w-full max-w-xs">
          <CardBody className="flex justify-center py-3">
            <ButtonLink href="/" variant="secondary">
              返回首頁
            </ButtonLink>
          </CardBody>
        </Card>
      </div>
    </HubShell>
  );
}
