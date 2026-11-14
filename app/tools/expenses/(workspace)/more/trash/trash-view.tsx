"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SegmentedControl } from "@/components/expenses/button";
import { ListCard, ListRow } from "@/components/expenses/list-row";
import { PageHeader } from "@/components/expenses/page-header";
import { StickyToolbar } from "@/components/expenses/sticky-toolbar";
import { TransactionRowLabel } from "@/components/expenses/transaction-row-label";
import { SelectionBar, SelectionDot } from "@/components/expenses/selection-bar";
import { ConfirmModal } from "@/components/expenses/confirm-modal";
import { text } from "@/components/expenses/theme";
import { useToast } from "@/components/expenses/toast";
import { useAsyncAction } from "@/components/expenses/use-async-action";
import { useBusy } from "@/components/expenses/busy";
import { ICON_PATHS } from "@/components/expenses/icon-paths";
import { categoryColorClass } from "@/lib/expenses/categories";
import { TRASH_KIND_LABEL, trashGroupOf, type TrashGroup, type TrashItemDTO, type TrashKind } from "@/lib/expenses/trash";
import { formatCurrency, formatDateWithWeekday } from "@/lib/format";

/** 舊資料沒有存圖示時依種類退回的預設圖（2026-11 之前刪掉的東西）。 */
const KIND_ICON: Record<TrashKind, string> = {
  transaction: ICON_PATHS.settingCategories,
  transfer: ICON_PATHS.accountTransfer,
  goal: ICON_PATHS.settingGoals,
  recurringRule: ICON_PATHS.settingRecurring,
  account: ICON_PATHS.settingAssets,
  accountType: ICON_PATHS.settingAccountTypes,
  category: ICON_PATHS.settingCategories,
};

/** 「設定 › 最近刪除」。
 *
 *  **為什麼是獨立一頁而不是彈窗**：設定頁那一列跟它上下的收支分類、預算設定長得一模一樣
 *  （圖示＋說明＋右邊一個「›」），隔壁點了都是換頁，只有這一列開彈窗。而且這裡面還要再開
 *  確認彈窗，彈窗疊彈窗之後，手機的返回手勢會直接把整個記帳本退掉，而不是關掉最上層。
 *  變成一頁之後：網址可以指（刪除失敗的提示就能直接連過來）、返回鍵行為正常、設定頁也
 *  不用為了「可能不會打開」的東西先把整包垃圾桶讀出來。
 *
 *  **沒有自動過期**：這些是使用者自己記了很久的資料，時間到了自己消失會嚇到人，而且
 *  「我以為還在」比「垃圾桶有點滿」糟得多。只能由使用者自己按「永久刪除」。
 *
 *  還原的三種結果（正常、撞名被改名、原本的帳戶已不在）都會用提示講清楚——後兩種不是
 *  錯誤，但使用者需要知道東西回來之後長得跟原本不太一樣。 */
export function TrashView({ initialItems }: { initialItems: TrashItemDTO[] }) {
  const router = useRouter();
  const showToast = useToast();
  const runBusy = useBusy();
  const [items, setItems] = useState(initialItems);
  // 勾起來的那幾項。還原跟永久刪除都靠工具列那兩顆，每一列不再各掛一組按鈕——一列兩顆
  // 小按鈕在手機上很容易按錯，而且「永久刪除」被按錯的代價是資料真的沒了。
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [purgeOpen, setPurgeOpen] = useState(false);
  // 按下還原之後、真的還原之前：先問伺服器這批會不會撞名（見 trash.server.ts 的
  // previewRestore）。有撞名才把這個彈窗打開，沒有的話直接還原，不多擋一步。
  const [renameConfirm, setRenameConfirm] = useState<{ label: string; renamedTo: string }[] | null>(null);
  // 種類篩選。做成膠囊而不是分頁：垃圾桶平常是空的，一進來先看到七個分頁很笨重，而且
  // 多數情況要找的是「我剛剛刪掉的那一筆」，照日期往下看就到了。只有在一次刪了很多種
  // 東西、要挑其中一類還原的時候才需要篩，所以它是可選的收斂手段，不是主要的瀏覽方式。
  const [group, setGroup] = useState<TrashGroup>("all");

  const visible = items.filter((i) => group === "all" || trashGroupOf(i.kind) === group);

  // 勾選的項目只算「現在看得到的」：篩選切換後，之前勾到、現在被篩掉的那幾項要跟著
  // 失效，不然「還原 N 項」會把看不見的東西算進去（跟 useSelection 同一個理由）。
  const chosen = visible.filter((i) => selected.has(i.id));

  const toggle = (id: string) =>
    setSelected((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function post(body: Record<string, unknown>) {
    const data: {
      items?: TrashItemDTO[];
      error?: string;
      renamedTo?: string;
      droppedRefs?: number;
      deleted?: number;
      renames?: { label: string; renamedTo: string }[];
    } = await fetch(
      "/api/expenses/trash",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    )
      .then((r) => r.json())
      .catch(() => ({ error: "操作失敗，再試一次" }));
    if (data.items) setItems(data.items);
    return data;
  }

  // 依刪除日期分組（新的在前，listTrash 已經排好序，所以照順序塞就是對的）。
  const groups = new Map<string, TrashItemDTO[]>();
  for (const item of visible) {
    const date = item.deletedAt.slice(0, 10);
    groups.set(date, [...(groups.get(date) ?? []), item]);
  }

  /** 批次還原。逐筆依序送出——還原是把原始文件插回去，同時插好幾筆時撞名改名的序號
   *  會算錯（兩筆都看到「餐飲」還在，於是都改成「餐飲(2)」）。 */
  const restore = useAsyncAction(async (targets: TrashItemDTO[]) => {
    let renamed = 0;
    let dropped = 0;
    // 「還原中」跟刪除走同一個共用遮罩：還原分類會去改交易的 categoryId，一次還原好
    // 幾項時要跑一會兒，沒有遮罩的話按下去完全沒反應，使用者會以為沒按到再按一次。
    const failed = await runBusy("還原中…", async () => {
      for (const item of targets) {
        const data = await post({ action: "restore", id: item.id });
        if (data.error) return data.error;
        if (data.renamedTo) renamed += 1;
        else if (data.droppedRefs) dropped += 1;
      }
      return null;
    });
    if (failed) {
      showToast(failed);
      return;
    }
    setSelected(new Set());
    // 還原出去的東西會影響別頁的數字（還原一條固定收支規則＝它過去的期數又回來了，
    // 設定頁那顆待確認徽章要跟著變）。整頁重抓最簡單也最不會漏。
    router.refresh();
    // 撞名改名、原本掛的帳戶不在了——這兩種不是錯誤，但使用者需要知道東西回來之後
    // 長得跟原本不太一樣。
    if (renamed > 0) showToast(`已還原 ${targets.length} 項，其中 ${renamed} 項因為名稱重複而改了名`);
    else if (dropped > 0) showToast(`已還原 ${targets.length} 項，其中 ${dropped} 項原本掛的帳戶已經不在了`);
    else showToast(`已還原 ${targets.length} 項`);
  });

  /** 按下「還原」先走這裡：撞名的話先問過，沒撞名就直接還原。 */
  const askRestore = useAsyncAction(async (targets: TrashItemDTO[]) => {
    const data: { renames?: { label: string; renamedTo: string }[] } = await post({ action: "preview", ids: targets.map((t) => t.id) });
    if (data.renames && data.renames.length > 0) {
      setRenameConfirm(data.renames);
      return;
    }
    await restore.run(targets);
  });

  return (
    <div className="flex flex-col gap-4">
      {items.length === 0 ? (
        <>
          <PageHeader flush title="最近刪除" />
          <p className={`px-1 ${text.faint}`}>目前沒有已刪除的項目。</p>
        </>
      ) : (
        <>
          {/* 標題跟種類篩選排同一列、整塊釘住：這一頁的工具列固定有兩列（篩選＋選取），
              標題自己再佔一列的話，清單在手機上只剩半個畫面。篩選那幾顆字很短，擠得下。 */}
          <StickyToolbar>
            <PageHeader
              flush
              title="最近刪除"
              actions={
                <SegmentedControl
                  value={group}
                  onChange={setGroup}
                  size="xs"
                  options={[
                    { value: "all", label: "全部" },
                    { value: "entry", label: "明細" },
                    { value: "category", label: "分類" },
                    { value: "account", label: "帳戶" },
                  ]}
                />
              }
            />
            {/* 跟其他清單頁的選取工具列同一顆元件：左邊全選＋已選幾項，右邊還原（淡紫
                膠囊）跟永久刪除（紅字）。這一頁永遠處在選取狀態，所以沒有「選取」開關。 */}
            <SelectionBar
              count={chosen.length}
              total={visible.length}
              actions={[
                {
                  label: "還原",
                  onClick: () => void askRestore.run(chosen),
                  disabled: restore.busy || askRestore.busy,
                },
              ]}
              deleteLabel="永久刪除"
              onToggleAll={() => setSelected(chosen.length === visible.length ? new Set() : new Set(visible.map((i) => i.id)))}
              onDelete={() => setPurgeOpen(true)}
            />
          </StickyToolbar>

          {/* 切到某個分頁但那個分頁剛好沒東西（例如垃圾桶裡只有分類，切去「帳戶」）：
              講清楚是「這個分頁沒有」，不要整塊空白讓人以為沒反應。 */}
          {visible.length === 0 && <p className={`px-1 ${text.faint}`}>還沒有任何資料。</p>}

          {/* 依「刪除日期」分組，日期當小標題——跟明細頁的消費清單同一種排法。
              一天刪好幾次是常有的事，沒有分組的話整串看起來就是一長條，要找「我昨天
              刪掉的那筆」只能一列一列看日期。 */}
          <div className="flex flex-col gap-4">
            {[...groups.entries()].map(([date, dayItems]) => (
              <div key={date}>
                <p className={`mb-1.5 px-1 font-medium ${text.muted}`}>{formatDateWithWeekday(date)}</p>
                <ListCard>
                  {dayItems.map((item) => {
                    const isEntry = trashGroupOf(item.kind) === "entry";
                    // 明細（交易／轉帳）刪除當下把「日期 · 金額」存成一串 sublabel（見
                    // transactions.server.ts／transfers.server.ts），這裡拆開來：金額挪到
                    // 右邊，跟首頁「最近消費」同一個位置、同一種樣式。
                    const sublabelParts = item.sublabel?.split(" · ") ?? [];
                    const amount = isEntry ? Number(sublabelParts[sublabelParts.length - 1]) : NaN;
                    const hasAmount = isEntry && !Number.isNaN(amount);
                    const restSublabel = hasAmount ? sublabelParts.slice(0, -1).join(" · ") : item.sublabel;

                    if (isEntry) {
                      // 明細列直接借用明細頁／首頁最近消費同一顆 TransactionRowLabel，而不是
                      // 自己複製一份長得很像的 JSX——那顆字重／顏色之後要調，這裡才會跟著動。
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="checkbox"
                          aria-checked={selected.has(item.id)}
                          onClick={() => toggle(item.id)}
                          className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                        >
                          <SelectionDot selected={selected.has(item.id)} />
                          <TransactionRowLabel
                            icon={item.icon || KIND_ICON[item.kind]}
                            iconClassName={item.color ? categoryColorClass[item.color] : undefined}
                            title={item.label}
                            subtitle={
                              // 有分類路徑快照（交易）就照明細頁／首頁最近消費同一種排法，標題下
                              // 面只放「大分類 › 子分類」；轉帳沒有分類，退回種類＋日期。
                              item.categoryPath ?? (
                                <>
                                  {TRASH_KIND_LABEL[item.kind]}
                                  {restSublabel ? ` · ${restSublabel}` : ""}
                                  {item.docCount > 1 ? ` · 共 ${item.docCount} 項` : ""}
                                </>
                              )
                            }
                          />
                          {hasAmount && (
                            <span className="shrink-0 tabular-nums font-semibold text-[#4A3B7C]">{formatCurrency(amount)}</span>
                          )}
                        </button>
                      );
                    }

                    // 分類／帳戶列照各自設定頁的清單樣式，直接用那兩頁清單共用的 ListRow：
                    // 單行名稱，不掛右側附註文字（跟那兩頁清單一樣乾淨）。
                    return (
                      <ListRow
                        key={item.id}
                        icon={item.icon || KIND_ICON[item.kind]}
                        iconClassName={item.color ? categoryColorClass[item.color] : undefined}
                        leading={<SelectionDot selected={selected.has(item.id)} />}
                        name={item.label}
                        onClick={() => toggle(item.id)}
                      />
                    );
                  })}
                </ListCard>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 撞名確認：現有的清單裡已經有同名的東西，還原回來的那幾項會被自動加序號。
          一次列出全部會改名的，不是一項跳一次——批次還原十項、其中三項撞名的話，
          連跳三個長得一樣的彈窗只會讓人直接亂按。 */}
      <ConfirmModal
        open={renameConfirm !== null}
        title="有同名的分類還在"
        danger={false}
        confirmLabel="還原並改名"
        message={
          <>
            還原之後這{(renameConfirm?.length ?? 0) > 1 ? ` ${renameConfirm?.length} 項` : "一項"}會自動加上序號，因為目前的清單裡已經有同名的：
            <span className="mt-2 block">
              {renameConfirm?.map((r) => (
                <span key={`${r.label}-${r.renamedTo}`} className="block">
                  {r.label} → {r.renamedTo}
                </span>
              ))}
            </span>
            <span className="mt-2 block">不想改名的話先取消，去把現有的那個改名或刪掉，再回來還原。</span>
          </>
        }
        onConfirm={async () => {
          setRenameConfirm(null);
          await restore.run(chosen);
        }}
        onClose={() => setRenameConfirm(null)}
      />

      {/* 永久刪除是這一頁唯一不可逆的動作，所以要列出刪的是哪幾項、而且明講救不回來。
          選到三項以上就不一一列出（名稱可能很長），只講數量。 */}
      <ConfirmModal
        open={purgeOpen}
        title="永久刪除"
        message={
          <>
            {chosen.length === 1 ? `「${chosen[0]?.label ?? ""}」` : `勾選的 ${chosen.length} 項`}
            會從垃圾桶裡徹底移除，之後沒有辦法再還原。
            {chosen.length > 1 && chosen.length <= 3 && (
              <span className="mt-2 block">
                {chosen.map((i) => (
                  <span key={i.id} className="block">
                    {i.label}
                  </span>
                ))}
              </span>
            )}
          </>
        }
        confirmLabel="永久刪除"
        onConfirm={async () => {
          // 逐筆送出：purge 一次只收一個 id，而且每次都回傳最新的完整清單。
          await runBusy("刪除中…", async () => {
            for (const item of chosen) await post({ action: "purge", id: item.id });
          });
          setSelected(new Set());
          showToast(`已永久刪除 ${chosen.length} 項`);
        }}
        onClose={() => setPurgeOpen(false)}
      />
    </div>
  );
}
