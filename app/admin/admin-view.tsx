"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Badge, Button, ButtonLink, Card, CardBody, FaIcon, PageHeader, SectionLabel } from "@/components/ui";
import { TOOLS_REGISTRY } from "@/lib/tools-registry";

interface AdminUser {
  id: string;
  username: string;
  name: string;
  tools: string[];
  isAdmin: boolean;
}

/** 管理後台——一個帳號一張卡：上面是這個人是誰，下面是勾工具權限的膠囊。
 *
 *  **不用表格**：原本是一張 min-w-[520px] 的表，在 430px 的 App 外框裡只能橫向捲動
 *  （要勾第二個工具得先把表格往左推，而且欄位標題在最上面，捲下去就看不出那一欄是哪個
 *  工具）。每個工具一顆帶名字的膠囊，不管多窄都看得懂自己在勾什麼，工具變多也只是換行。
 *
 *  **刪除走批次選取**：原本是每張卡右上角一顆垃圾桶、點了當場展開確認。要刪三個帳號就
 *  得重複三次「點垃圾桶 → 確認」，而且每一次都是一個無法復原的動作分開問。改成跟記帳本
 *  的清單一樣：按「選取」進入選取模式，勾完一次問一次、一次刪完。
 *
 *  **所有失敗都要講出來**：API 掛掉時（dev server 回 500 的 HTML 錯誤頁就是一例）原本
 *  只是把畫面悄悄還原，看起來就像「按了沒反應」。現在不管是存權限還是刪帳號，失敗都會
 *  在畫面底部跳一則提示——那個位置不管捲到哪裡都看得到，不像頁首的錯誤訊息會被捲走。
 *
 *  **回得去**：入口在首頁的「帳號」區，出口有頁首左上角那顆「工具列表」（在外殼的
 *  header 裡、不跟著內容捲走，見 site-shell.tsx）跟清單最下面那顆按鈕。 */
export function AdminView() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // 畫面底部那則會自己消失的提示（存檔失敗、刪完幾個…）。
  const [notice, setNotice] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  // 哪些使用者的工具清單正在打 API 存檔，存檔中要把對應的膠囊 disable 掉，
  // 不然在請求還沒回來前使用者又勾了一次，畫面狀態跟資料庫會對不起來。
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data: { users?: AdminUser[]; error?: string }) => {
        if (data.users) setUsers(data.users);
        else setLoadError(data.error ?? "讀取失敗");
      })
      .catch(() => setLoadError("連線失敗，請稍後再試"));
  }, []);

  // 提示自己收掉。計時器開在這裡（不是在按鈕的事件裡）才能在提示被下一則取代時
  // 一起把舊的計時器清掉，不然第二則會被第一則的計時器提早關掉。
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  /** API 回來的東西不一定是 JSON——伺服器掛掉時 Next.js 回的是一頁 HTML 錯誤頁，
   *  直接 res.json() 會丟例外，原本就是在這裡把失敗吃掉的。 */
  async function readJson(res: Response): Promise<{ error?: string }> {
    return res
      .json()
      .then((d: { error?: string }) => d)
      .catch(() => ({}));
  }

  async function toggleTool(targetUser: AdminUser, toolId: string) {
    const nextTools = targetUser.tools.includes(toolId)
      ? targetUser.tools.filter((t) => t !== toolId)
      : [...targetUser.tools, toolId];

    setUsers((prev) => prev?.map((u) => (u.id === targetUser.id ? { ...u, tools: nextTools } : u)) ?? null);
    setSavingIds((prev) => new Set(prev).add(targetUser.id));
    // 存檔失敗就把畫面上的勾選改回原來的樣子，並且講出來——只還原不講的話，使用者
    // 看到的是「點了自己跳回去」，會以為是手滑或介面壞掉。
    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tools: nextTools }),
      });
      if (!res.ok) {
        const data = await readJson(res);
        setUsers((prev) => prev?.map((u) => (u.id === targetUser.id ? targetUser : u)) ?? null);
        setNotice({ tone: "error", text: data.error ?? `「${targetUser.name}」的工具權限沒存起來，請再試一次` });
      }
    } catch {
      setUsers((prev) => prev?.map((u) => (u.id === targetUser.id ? targetUser : u)) ?? null);
      setNotice({ tone: "error", text: "連線失敗，工具權限沒存起來" });
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetUser.id);
        return next;
      });
    }
  }

  const deletable = (users ?? []).filter((u) => u.id !== me?.id);
  const selected = deletable.filter((u) => selectedIds.has(u.id));
  const allSelected = deletable.length > 0 && selected.length === deletable.length;

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function leaveSelecting() {
    setSelecting(false);
    setSelectedIds(new Set());
  }

  /** 一個一個刪，不是 Promise.all：刪一個帳號會連帶清掉它在各工具底下的資料，
   *  併發送出去的話哪一個先跑完不一定，而且失敗時說不清是哪幾個沒刪掉。 */
  async function handleDeleteSelected() {
    setDeleting(true);
    const failed: string[] = [];
    for (const target of selected) {
      try {
        const res = await fetch(`/api/admin/users/${target.id}`, { method: "DELETE" });
        if (!res.ok) {
          failed.push(target.name);
          continue;
        }
        setUsers((prev) => prev?.filter((u) => u.id !== target.id) ?? null);
      } catch {
        failed.push(target.name);
      }
    }
    setDeleting(false);
    setConfirmOpen(false);
    leaveSelecting();
    const done = selected.length - failed.length;
    if (failed.length === 0) setNotice({ tone: "ok", text: `已刪除 ${done} 個帳號` });
    else if (done === 0) setNotice({ tone: "error", text: `刪除失敗（${failed.join("、")}），請再試一次` });
    else setNotice({ tone: "error", text: `刪除了 ${done} 個，${failed.join("、")} 沒刪成功` });
  }

  const adminCount = users?.filter((u) => u.isAdmin).length ?? 0;

  return (
    // 選取模式時底部多一條操作列（fixed、不佔版面），所以內容要多留一截，
    // 不然最後一張卡會被蓋住。
    <div className={`flex flex-1 flex-col gap-4 ${selecting ? "pb-20" : ""}`}>
      <PageHeader title="管理後台" description="管理每個帳號能用哪些工具，或是刪除已註冊的帳號。" />

      {/* 兩個數字擺在最上面：進這一頁最先想知道的就是「現在有幾個人」。 */}
      {users && (
        <div className="flex gap-2">
          {[
            { label: "已註冊帳號", value: users.length },
            { label: "其中管理者", value: adminCount },
          ].map((stat) => (
            <div key={stat.label} className="flex-1 rounded-2xl border border-line bg-surface px-4 py-3">
              <p className="text-xs text-muted">{stat.label}</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums text-ink">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {loadError && (
        <p className="flex items-center gap-2 rounded-xl bg-negative-soft px-3 py-2.5 text-xs font-medium text-negative">
          <FaIcon icon="circle-exclamation" />
          {loadError}
        </p>
      )}

      {!users ? (
        <Card>
          <CardBody className="py-6 text-center text-xs text-muted">載入中…</CardBody>
        </Card>
      ) : (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <SectionLabel>帳號與工具權限</SectionLabel>
            {/* 只有自己一個帳號時不給「選取」：唯一能選的對象是自己，而自己不能刪。 */}
            {deletable.length > 0 && (
              <button
                type="button"
                onClick={() => (selecting ? leaveSelecting() : setSelecting(true))}
                className="-mt-2 shrink-0 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-brand transition-colors hover:bg-surface-2"
              >
                {selecting ? "取消選取" : "選取"}
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {users.map((u) => {
              const isSelf = u.id === me?.id;
              const saving = savingIds.has(u.id);
              const picked = selectedIds.has(u.id);
              return (
                <Card key={u.id} className={picked ? "border-brand" : ""}>
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    {/* 選取模式時整列（頭像那一行）都是選取鈕，不是只有左邊那個小圈圈
                        ——圈圈只有 24px，手指按不準。自己那一列不能刪，所以不給圈圈。 */}
                    {selecting && !isSelf && (
                      <span
                        aria-hidden
                        className={`grid size-6 shrink-0 place-items-center rounded-full border transition-colors ${
                          picked ? "border-brand bg-brand text-white" : "border-line bg-surface text-transparent"
                        }`}
                      >
                        <FaIcon icon="check" size={10} />
                      </span>
                    )}
                    {!selecting && (
                      // 沒有頭像圖，用名字的第一個字墊著。[...name] 而不是 slice(0,1)：
                      // 中文、表情符號在 UTF-16 裡是兩個碼元，slice 會切出半個字。
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-base font-bold text-brand">
                        {[...u.name][0] ?? "?"}
                      </span>
                    )}
                    {selecting && !isSelf ? (
                      <button type="button" onClick={() => toggleSelected(u.id)} className="min-w-0 flex-1 text-left">
                        <UserLabel user={u} />
                      </button>
                    ) : (
                      <span className="min-w-0 flex-1">
                        <UserLabel user={u} />
                      </span>
                    )}
                    {/* 不能刪自己目前登入的帳號——與其放一顆按不動的刪除鍵，不如直接說
                        這一列就是你自己。 */}
                    {isSelf && <Badge tone="neutral">登入中</Badge>}
                  </div>

                  <div className="border-t border-[#F2EEFA] px-4 py-3">
                    <p className="mb-2 text-xs font-medium text-muted">
                      可用工具
                      {saving && <span className="ml-1.5 text-brand">儲存中…</span>}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {TOOLS_REGISTRY.map((tool) => {
                        const on = u.tools.includes(tool.toolId);
                        return (
                          <label
                            key={tool.toolId}
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-within:ring-2 focus-within:ring-brand/40 ${
                              on ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface text-muted hover:text-ink"
                            } ${saving ? "pointer-events-none opacity-50" : ""}`}
                          >
                            {/* 底下是一顆真的勾選框（sr-only，看不到但還在），鍵盤、讀螢幕
                                軟體、表單語意全部照原生的來；外觀用左邊那個勾／加號表示，
                                不是系統預設的藍色方框。 */}
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={saving}
                              onChange={() => toggleTool(u, tool.toolId)}
                              className="sr-only"
                            />
                            <FaIcon icon={on ? "check" : "plus"} size={10} className={on ? "text-brand" : "text-[#C7BFE6]"} />
                            {tool.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* 清單可能很長，捲到底的人不一定會想到往上找頁首那顆返回鍵——結尾再給一個出口，
          不要讓這一頁變成死路。 */}
      <div className="mt-auto flex justify-center pt-4">
        <ButtonLink href="/" variant="secondary">
          <FaIcon icon="chevron-left" size={11} />
          回到工具列表
        </ButtonLink>
      </div>

      {/* 底下這幾塊都是 fixed——外殼那張卡片有 transform，所以 fixed 是貼著卡片邊界，
          不是整個瀏覽器視窗（跟記帳本底部導覽列同一招，見 expenses-mobile-nav.tsx）。 */}
      {selecting && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-2 border-t border-line bg-white/95 px-5 py-3 backdrop-blur-sm">
          <span className="flex-1 text-xs font-medium text-muted tabular-nums">已選 {selected.length} 個帳號</span>
          <Button variant="ghost" onClick={() => setSelectedIds(allSelected ? new Set() : new Set(deletable.map((u) => u.id)))}>
            {allSelected ? "取消全選" : "全選"}
          </Button>
          <Button
            variant="secondary"
            className="border-negative py-2 text-negative"
            disabled={selected.length === 0}
            onClick={() => setConfirmOpen(true)}
          >
            刪除
          </Button>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-30 flex items-end bg-black/30 p-4">
          <div className="w-full rounded-[1.75rem] bg-surface p-5 shadow-2xl">
            <h2 className="text-base font-bold text-ink">刪除 {selected.length} 個帳號？</h2>
            {/* 把名字列出來再問一次：選取模式下勾了什麼很容易記錯，而這個動作沒有還原。 */}
            <p className="mt-2 text-xs leading-relaxed text-ink">{selected.map((u) => u.name).join("、")}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              這些帳號在各工具底下存的資料也會一併刪除，無法復原。
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" className="flex-1" disabled={deleting} onClick={() => setConfirmOpen(false)}>
                取消
              </Button>
              <Button variant="secondary" className="flex-1 border-negative text-negative" disabled={deleting} onClick={handleDeleteSelected}>
                {deleting ? "刪除中…" : "確定刪除"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-5 pb-20">
          <p
            className={`rounded-full px-4 py-2 text-xs font-medium shadow-lg ${
              notice.tone === "error" ? "bg-negative text-white" : "bg-ink text-white"
            }`}
          >
            {notice.text}
          </p>
        </div>
      )}
    </div>
  );
}

/** 名字＋帳號＋管理者徽章——選取模式下這一塊整個是選取鈕、平常是純文字，
 *  兩種情況長得一樣，所以抽成一個元件而不是複製兩份 JSX。 */
function UserLabel({ user }: { user: AdminUser }) {
  return (
    <>
      <span className="flex items-center gap-1.5">
        <span className="truncate text-sm font-semibold text-ink">{user.name}</span>
        {user.isAdmin && <Badge tone="brand">管理者</Badge>}
      </span>
      <span className="block truncate text-xs text-muted">@{user.username}</span>
    </>
  );
}
