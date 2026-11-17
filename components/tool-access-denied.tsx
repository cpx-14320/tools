import { ButtonLink, FaIcon } from "@/components/ui";
import { SiteShell } from "@/components/site-shell";

/** 所有工具共用的「無權限瀏覽」畫面——使用者已登入，但目前這個帳號沒有被勾選這個工具的
 *  使用權限（見 lib/auth.ts 的 hasToolAccess）。用 SiteShell 包起來，不要套任何特定工具的
 *  殼（TransitShell／ExpensesShell），因為使用者本來就進不去那個工具，不該看到它的介面。
 *
 *  圖示用 Font Awesome 的鎖，不是 🔒：表情符號的長相由作業系統字型決定，跟這個 App 其他
 *  地方的線條圖示不是同一種畫風（理由見 ui.tsx 的 FaIcon）。 */
export function ToolAccessDenied({ toolName }: { toolName: string }) {
  return (
    <SiteShell back={{ href: "/", label: "工具列表" }} title="無權限">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-10 text-center">
        <span className="grid size-16 place-items-center rounded-[1.25rem] bg-negative-soft text-negative">
          <FaIcon icon="lock" size={24} />
        </span>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-ink">無權限瀏覽</h1>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            你的帳號目前沒有「{toolName}」的使用權限，
            <br />
            請聯絡管理者開通。
          </p>
        </div>
        <ButtonLink href="/" variant="secondary" className="mt-1">
          <FaIcon icon="chevron-left" size={11} />
          回到工具列表
        </ButtonLink>
      </div>
    </SiteShell>
  );
}
