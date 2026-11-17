"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { BrandMark } from "@/components/brand-mark";
import { Badge, ButtonLink, IconTile, ListCard, ListRow, SectionLabel } from "@/components/ui";
import { TOOLS_REGISTRY } from "@/lib/tools-registry";

/** 工具入口頁——這個站的「首頁」，長得像 App 的主畫面：
 *
 *    已登入  最上面一張紫色漸層的帳號卡（我是誰、有幾個工具可以用），接著「小工具」
 *            清單，最後「帳號」那一區（管理後台、登出）。
 *    未登入  帳號卡換成品牌標記＋一句說明＋登入／註冊兩顆按鈕，工具清單照樣列出來
 *            （看得到有什麼東西才有理由註冊），每一列標著「請先登入」、點了去登入頁。
 *
 *  **只有一種版型**：原本是「手機＝整列可點的清單／桌機＝三欄卡片格」兩套 responsive
 *  版型，但外殼改成不分寬度都是 430px 的 App 卡片之後（見 site-shell.tsx），三欄格在
 *  430px 裡沒有意義，清單本來也就是手機上最好按的形狀。
 *
 *  載入中（loading）時不要顯示任何跟權限有關的記號：工具清單是靜態資料、一定畫得出來，
 *  但「能不能點」要等 /api/auth/me 回來才知道。先畫一個猜的狀態再改，使用者會看到
 *  「需要權限」閃一下變成可以點。 */
export function HubView() {
  const { user, loading, logout } = useAuth();
  const grantedCount = TOOLS_REGISTRY.filter((t) => (user?.tools ?? []).includes(t.toolId)).length;

  return (
    <div className="flex flex-1 flex-col gap-5">
      {/* loading 時這一塊整個不畫：它的兩種長相（帳號卡／登入邀請）差異太大，先畫錯的
          那個再換，等於整頁跳一次。下面的工具清單高度固定，所以版面不會上下亂跳。 */}
      {!loading &&
        (user ? (
          <div
            className="rounded-[1.75rem] px-5 py-5 text-white"
            style={{
              background: "linear-gradient(135deg, #8A7CEE 0%, #6F5FD6 60%, #6558C8 100%)",
              boxShadow: "0 16px 32px -16px rgba(111,95,214,0.9)",
            }}
          >
            <p className="text-xs font-medium text-white/70">歡迎回來</p>
            <p className="mt-1 truncate text-2xl font-bold tracking-tight">{user.name}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium">@{user.username}</span>
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium tabular-nums">
                {grantedCount} / {TOOLS_REGISTRY.length} 個工具可用
              </span>
              {user.isAdmin && <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-brand">管理者</span>}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 pb-1 pt-2 text-center">
            <BrandMark size={60} />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-ink">一組帳號，一包小工具</h1>
              <p className="mt-1 text-xs leading-relaxed text-muted">登入之後，底下的工具都在同一個地方切換使用。</p>
            </div>
            <div className="mt-1 flex w-full gap-2">
              <ButtonLink href="/login" className="flex-1">
                登入
              </ButtonLink>
              <ButtonLink href="/register" variant="secondary" className="flex-1">
                註冊
              </ButtonLink>
            </div>
          </div>
        ))}

      <div>
        <SectionLabel>小工具</SectionLabel>
        <ListCard>
          {TOOLS_REGISTRY.map((tool) => {
            const hasAccess = !loading && (user?.tools ?? []).includes(tool.toolId);
            // 沒登入的人看到的不是「需要權限」而是「請先登入」，而且整列會把他帶去登入頁。
            // 兩種情況都寫「需要權限」又都不能點的話，沒登入的人會以為要跟管理員申請，
            // 實際上登入完就有了。
            const needLogin = !loading && !user;
            const dim = !loading && !hasAccess && !needLogin;
            const icon = tool.iconImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tool.iconImage} alt="" className={`size-10 object-contain ${dim ? "grayscale" : ""}`} />
            ) : (
              // 還沒有插畫的工具用線條圖示墊著，不要用表情符號——理由見 ui.tsx 的 FaIcon。
              <IconTile icon="shapes" />
            );

            return (
              <ListRow
                key={tool.toolId}
                href={hasAccess ? tool.href : needLogin ? "/login" : undefined}
                icon={icon}
                title={tool.name}
                desc={tool.description}
                chevron={hasAccess || needLogin}
                right={
                  dim ? <Badge tone="future">需要權限</Badge> : needLogin ? <Badge tone="brand">請先登入</Badge> : undefined
                }
                className={dim ? "opacity-60" : ""}
              />
            );
          })}
        </ListCard>
      </div>

      {/* 帳號那一區只有登入後才有意義。管理後台放在這裡（不是只藏在頁首的小按鈕裡）：
          它是一個「頁面」，就該跟其他頁面一樣是清單裡可以點的一列。 */}
      {!loading && user && (
        <div>
          <SectionLabel>帳號</SectionLabel>
          <ListCard>
            {user.isAdmin && (
              <ListRow
                href="/admin"
                icon={<IconTile icon="shield-halved" />}
                title="管理後台"
                desc="開通每個帳號能用的工具、刪除帳號"
                chevron
              />
            )}
            <ListRow
              onClick={() => void logout()}
              icon={<IconTile icon="arrow-right-from-bracket" tone="negative" />}
              title="登出"
              desc={`目前登入 @${user.username}`}
            />
          </ListCard>
        </div>
      )}

      {/* 整頁最底下那行小字——卡片式版面很容易讓人以為下面還有東西，給一個明確的結尾。
          未登入時那句話還兼作「註冊」的第二個入口（上面的按鈕要往回捲才看得到）。
          跟上面兩塊一樣，loading 時不畫：這行字有登入／未登入兩種版本，會閃。 */}
      <p className="mt-auto pt-4 text-center text-xs text-muted">
        {loading ? null : user ? (
          "工具會陸續增加，沒有權限的項目請找管理者開通。"
        ) : (
          <>
            還沒有帳號？{" "}
            <Link href="/register" className="font-semibold text-brand">
              註冊一個
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
