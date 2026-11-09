"use client";

import { useState } from "react";
import { Modal } from "./modal";
import { Button, PillButton } from "./button";
import { ListCard, ListRow } from "./list-row";
import { SelectionDot } from "./selection-bar";
import { categoryColorClass } from "@/lib/expenses/categories";
import { ConfirmModal } from "./confirm-modal";
import { text } from "./theme";
import { useToast } from "./toast";
import { useAsyncAction } from "./use-async-action";
import { ICON_PATHS } from "./icon-paths";
import { TRASH_KIND_LABEL, type TrashItemDTO, type TrashKind } from "@/lib/expenses/trash";
import { formatDateWithWeekday } from "@/lib/format";

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

/** 設定頁的「最近刪除」。
 *
 *  **沒有自動過期**：這些是使用者自己記了很久的資料，時間到了自己消失會嚇到人，而且
 *  「我以為還在」比「垃圾桶有點滿」糟得多。只能由使用者自己按「永久刪除」或「清空」。
 *
 *  還原的三種結果（正常、撞名被改名、原本的帳戶已不在）都會用提示講清楚——後兩種不是
 *  錯誤，但使用者需要知道東西回來之後長得跟原本不太一樣。 */
export function TrashModal({
  open,
  items,
  onClose,
  onItemsChange,
  onRestored,
}: {
  open: boolean;
  items: TrashItemDTO[];
  onClose: () => void;
  onItemsChange: (items: TrashItemDTO[]) => void;
  /** 還原之後呼叫端可能要重抓自己的清單（設定頁沒有需要跟著更新的東西，所以是選填）。 */
  onRestored?: () => void;
}) {
  const showToast = useToast();
  // 勾起來的那幾項。還原跟永久刪除都靠底下那兩顆，每一列不再各掛一組按鈕——一列兩顆
  // 小按鈕在手機上很容易按錯，而且「永久刪除」被按錯的代價是資料真的沒了。
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [purgeOpen, setPurgeOpen] = useState(false);
  // 種類篩選。做成膠囊而不是分頁：垃圾桶平常是空的，一進來先看到七個分頁很笨重，而且
  // 多數情況要找的是「我剛剛刪掉的那一筆」，照日期往下看就到了。只有在一次刪了很多種
  // 東西、要挑其中一類還原的時候才需要篩，所以它是可選的收斂手段，不是主要的瀏覽方式。
  // 只列「垃圾桶裡真的有的種類」——列出七個固定選項，其中五個按了都是空的沒有意義。
  const [kindFilter, setKindFilter] = useState<TrashKind | null>(null);

  const kinds = [...new Set(items.map((i) => i.kind))];
  // 篩選條件如果指到一個已經沒有東西的種類（最後一筆被還原或永久刪除了），當作沒篩——
  // 不然畫面會停在一個空清單上，而且那個膠囊已經不在了，使用者按不掉它。
  const activeKind = kindFilter && kinds.includes(kindFilter) ? kindFilter : null;
  const visible = activeKind ? items.filter((i) => i.kind === activeKind) : items;

  // 勾選的項目只算「現在看得到的」：篩選切換後，之前勾到、現在被篩掉的那幾項要跟著
  // 失效，不然底下的「還原 N 項」會把看不見的東西算進去（跟 useSelection 同一個理由）。
  const chosen = visible.filter((i) => selected.has(i.id));
  const toggle = (id: string) =>
    setSelected((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function post(body: Record<string, unknown>) {
    const data: { items?: TrashItemDTO[]; error?: string; renamedTo?: string; droppedRefs?: number; deleted?: number } = await fetch(
      "/api/expenses/trash",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    )
      .then((r) => r.json())
      .catch(() => ({ error: "操作失敗，再試一次" }));
    if (data.items) onItemsChange(data.items);
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
    for (const item of targets) {
      const data = await post({ action: "restore", id: item.id });
      if (data.error) {
        showToast(data.error);
        return;
      }
      if (data.renamedTo) renamed += 1;
      else if (data.droppedRefs) dropped += 1;
    }
    setSelected(new Set());
    onRestored?.();
    // 撞名改名、原本掛的帳戶不在了——這兩種不是錯誤，但使用者需要知道東西回來之後
    // 長得跟原本不太一樣。
    if (renamed > 0) showToast(`已還原 ${targets.length} 項，其中 ${renamed} 項因為名稱重複而改了名`);
    else if (dropped > 0) showToast(`已還原 ${targets.length} 項，其中 ${dropped} 項原本掛的帳戶已經不在了`);
    else showToast(`已還原 ${targets.length} 項`);
  });

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="最近刪除"
        fullHeight
        footer={
          // 左下角原本是「清空垃圾桶」：那是一顆按下去就把全部東西永久刪掉的按鈕，
          // 擺在這裡太容易誤觸，而且想清空的人大可全選再按永久刪除。改成兩顆針對
          // 勾選項目的動作，沒勾任何一項時都是停用狀態。
          <div className="flex w-full items-center justify-between gap-2">
            <button
              type="button"
              disabled={chosen.length === 0}
              onClick={() => setPurgeOpen(true)}
              className="text-xs font-medium text-[#D1517E] disabled:opacity-40"
            >
              永久刪除{chosen.length > 0 ? ` ${chosen.length} 項` : ""}
            </button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={onClose}>
                關閉
              </Button>
              <Button disabled={chosen.length === 0 || restore.busy} onClick={() => restore.run(chosen)}>
                {restore.busy ? "還原中…" : `還原${chosen.length > 0 ? ` ${chosen.length} 項` : ""}`}
              </Button>
            </div>
          </div>
        }
      >
        {items.length === 0 ? (
          <p className={`px-1 ${text.faint}`}>目前沒有已刪除的項目。</p>
        ) : (
          <>
            <p className={`${text.muted} leading-relaxed`}>刪掉的項目會一直留在這裡，直到你自己清掉為止，不會自動消失。</p>
            {/* 只有兩種以上才顯示：垃圾桶裡只有交易的時候，一排「全部／交易」兩顆膠囊
                等於沒有篩選功能，只是多佔一行。 */}
            {kinds.length > 1 && (
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
                <PillButton active={activeKind === null} onClick={() => setKindFilter(null)}>
                  全部 {items.length}
                </PillButton>
                {kinds.map((kind) => (
                  <PillButton key={kind} active={activeKind === kind} onClick={() => setKindFilter(kind)}>
                    {TRASH_KIND_LABEL[kind]} {items.filter((i) => i.kind === kind).length}
                  </PillButton>
                ))}
              </div>
            )}
            {/* 依「刪除日期」分組，日期當小標題——跟明細頁的消費清單同一種排法。
                一天刪好幾次是常有的事，沒有分組的話整串看起來就是一長條，要找「我昨天
                刪掉的那筆」只能一列一列看日期。 */}
            {[...groups.entries()].map(([date, dayItems]) => (
              <div key={date}>
                <p className={`mb-1.5 px-1 font-medium ${text.muted}`}>{formatDateWithWeekday(date)}</p>
                <ListCard>
                  {dayItems.map((item) => (
                    // 整列就是勾選目標（跟明細頁的多選一樣），圓點只是指示器。
                    <ListRow
                      key={item.id}
                      icon={item.icon || KIND_ICON[item.kind]}
                      iconClassName={item.color ? categoryColorClass[item.color] : undefined}
                      leading={<SelectionDot selected={selected.has(item.id)} />}
                      name={
                        <span className="block min-w-0">
                          <span className={`block truncate ${text.body}`}>{item.label}</span>
                          <span className={`block truncate ${text.muted}`}>
                            {TRASH_KIND_LABEL[item.kind]}
                            {item.sublabel ? ` · ${item.sublabel}` : ""}
                            {/* 一次刪除連帶移除好幾個文件時講明白（刪分類會連子分類一起）。 */}
                            {item.docCount > 1 ? ` · 共 ${item.docCount} 項` : ""}
                          </span>
                        </span>
                      }
                      onClick={() => toggle(item.id)}
                    />
                  ))}
                </ListCard>
              </div>
            ))}
          </>
        )}
      </Modal>

      {/* 永久刪除是這個彈窗裡唯一不可逆的動作，所以要列出刪的是哪幾項、而且明講救不回來。
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
          for (const item of chosen) await post({ action: "purge", id: item.id });
          setSelected(new Set());
          showToast(`已永久刪除 ${chosen.length} 項`);
        }}
        onClose={() => setPurgeOpen(false)}
      />
    </>
  );
}
