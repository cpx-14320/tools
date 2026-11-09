"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "./modal";
import { AccountPickerModal } from "./account-picker-modal";
import { CategoryGridPicker } from "./category-grid-picker";
import { BusyOverlay } from "./busy-overlay";
import { useToast } from "./toast";
import type { SelectionAction, SelectionPending } from "./selection-bar";
import { categoryPath, needsSubcategory, type CategoryDTO, type CategoryKind } from "@/lib/expenses/categories";
import type { TransactionDTO } from "@/lib/expenses/transactions";
import type { AccountDTO } from "@/lib/expenses/accounts";
import type { AccountTypeDTO } from "@/lib/expenses/account-types";
import type { TransferDTO } from "@/lib/expenses/transfers";
import { formatDate } from "@/lib/format";

/** 多選之後「修改帳戶／修改分類」的那一整套：工具列上的兩顆按鈕、挑目標的彈窗、待確認
 *  狀態、送出。明細頁跟帳戶明細頁共用同一份——兩邊列的都是交易，操作當然該一模一樣。
 *
 *  **流程是三步**：勾選項目 →（彈窗）挑好要改成什麼 → 工具列顯示「修改帳戶 → 玉山銀行」，
 *  按「完成」才真的動資料。中間那一步以前是挑完就跳確認彈窗、在彈窗裡按鈕送出，問題是
 *  「挑選」跟「送出」被擠在同一個連續動作裡——彈窗一關一開，手指還在原地就已經改掉幾十筆。
 *  改成停在工具列上等一次明確的「完成」，而確認彈窗要講的那些話（原本掛在哪、橫跨哪段
 *  日期）改成工具列上的 detail 那一行，資訊沒有少。
 *
 *  回傳 `actions`、`pending` 給 SelectionBar，`element` 放在畫面任何地方（裡面是彈窗跟
 *  處理中遮罩，都是 fixed／portal，擺哪裡都不影響版面）。
 *
 *  **為什麼 hook 直接回 JSX**：這套東西的狀態跟畫面綁得很死（挑到哪個目標 → 確認彈窗
 *  要顯示什麼），拆成「hook 管狀態、元件畫畫面」的話兩邊要傳十幾個值來回。包成一個
 *  回傳 element 的 hook，呼叫端的接觸面最小。 */
export function useBulkEdit({
  transactions,
  categories,
  accounts,
  accountTypes,
  transfers,
  selectedIds,
  kind,
  onUpdated,
  onDone,
}: {
  transactions: TransactionDTO[];
  categories: CategoryDTO[];
  accounts: AccountDTO[];
  accountTypes: AccountTypeDTO[];
  transfers: TransferDTO[];
  selectedIds: Set<string>;
  /** 改分類時只列這一邊的分類，所以不可能把一筆支出改成收入分類。明細頁有收支分頁，
   *  傳目前那一頁；帳戶明細頁是支出收入混排的，就傳「選到的那批是哪一種」，兩種都有
   *  的時候傳 null——那時候沒有一份分類清單列得出來，見下面 actions。 */
  kind: CategoryKind | null;
  onUpdated: (transactions: TransactionDTO[]) => void;
  /** 改完之後呼叫端要做的事（退出選取模式）。 */
  onDone: () => void;
}): { actions: SelectionAction[]; pending?: SelectionPending; element: ReactNode } {
  const showToast = useToast();
  // 先開選擇彈窗挑目標，挑完存進 target——這時候還沒送出，工具列會變成待確認狀態，
  // 等使用者按「完成」才呼叫 apply。「改 23 筆」按錯了要一筆一筆救回來，所以挑完跟
  // 送出一定要是兩個分開的動作。
  const [picker, setPicker] = useState<"account" | "category" | null>(null);
  const [target, setTarget] = useState<{ kind: "account"; accountId: string | null } | { kind: "category"; categoryId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // 改分類彈窗裡「目前點到哪一格」。要傳回給 CategoryGridPicker 當 value，它才知道
  // 要展開哪個大分類底下的「項目」那一排。
  const [categoryPick, setCategoryPick] = useState("");

  const rows = transactions.filter((t) => selectedIds.has(t.id));

  const targetName =
    target?.kind === "account"
      ? target.accountId
        ? `改掛到「${accounts.find((a) => a.id === target.accountId)?.name ?? "（已刪除帳戶）"}」`
        : "改成不指定帳戶"
      : target?.kind === "category"
        ? `改成「${categoryPath(categories, target.categoryId)}」`
        : "";

  // 工具列第一行那句。用「→」而不是整句話：那一行寬度有限，右邊還要擺「完成」。
  const pendingSummary =
    target?.kind === "account"
      ? `修改帳戶 → ${target.accountId ? (accounts.find((a) => a.id === target.accountId)?.name ?? "（已刪除帳戶）") : "不指定"}`
      : target?.kind === "category"
        ? `修改分類 → ${categoryPath(categories, target.categoryId) || "（已刪除分類）"}`
        : "";

  /** 把選到的那批依某個欄位分組計數，用來在確認彈窗講清楚「原本是什麼，會被改掉」。
   *  只回傳**跟目標不一樣**的那幾組——本來就已經是目標值的不算「會被改掉」。 */
  function originSummary(label: (t: TransactionDTO) => string, isAlreadyTarget: (t: TransactionDTO) => boolean): string {
    const counts = new Map<string, number>();
    for (const t of rows) {
      if (isAlreadyTarget(t)) continue;
      const key = label(t);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].map(([name, n]) => `${name} ${n}`).join("、");
  }

  async function apply() {
    if (!target) return;
    setBusy(true);
    const body =
      target.kind === "account" ? { ids: [...selectedIds], accountId: target.accountId } : { ids: [...selectedIds], categoryId: target.categoryId };
    const data: { updated?: number; transactions?: TransactionDTO[] } = await fetch("/api/expenses/transactions/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    setBusy(false);
    if (!data.transactions) {
      showToast("改不動，再試一次");
      return;
    }
    onUpdated(data.transactions);
    // 報實際改到的筆數，不是選取的筆數——中途被別的裝置刪掉的那幾筆不會算進去。
    showToast(`已改好 ${data.updated ?? 0} 筆${targetName ? `，${targetName}` : ""}`);
    setTarget(null);
    onDone();
  }

  const actions: SelectionAction[] = [
    { label: "修改帳戶", onClick: () => setPicker("account") },
    {
      label: "修改分類",
      onClick: () => {
        // 選到的同時有支出跟收入時擋在這裡講原因，而不是把按鈕藏起來：按鈕消失的話
        // 使用者只會以為這一頁不支援改分類，不知道是自己選的那批跨了收支。
        if (!kind) {
          showToast("選到的有支出也有收入，請分開改分類");
          return;
        }
        // 每次打開都歸零，不要留著上一次點到一半的大分類。
        setCategoryPick("");
        setPicker("category");
      },
    },
  ];

  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : 1));

  const element = (
    <>
      {/* 挑帳戶用跟記帳時同一個彈窗（它本來就帶餘額、也本來就有「不指定」那一項）。 */}
      <AccountPickerModal
        open={picker === "account"}
        title="修改帳戶"
        accounts={accounts}
        accountTypes={accountTypes}
        transactions={transactions}
        categories={categories}
        transfers={transfers}
        onClose={() => setPicker(null)}
        onSelect={(accountId) => {
          setPicker(null);
          setTarget({ kind: "account", accountId: accountId || null });
        }}
      />

      {/* 只列目前這一邊的分類，所以不可能把一筆支出改成收入分類、把收支方向整個翻掉。
          子分類的規則也照舊（大分類底下有項目就要選到項目）。 */}
      {/* 不用 fullHeight：分類格子就那幾排，撐到滿版下面會空一大片。 */}
      <Modal open={picker === "category" && kind !== null} onClose={() => setPicker(null)} title="修改分類">
        <CategoryGridPicker
          categories={categories}
          kind={kind ?? "支出"}
          value={categoryPick}
          onChange={(categoryId) => {
            setCategoryPick(categoryId);
            // 點到還需要選項目的大分類時先不關窗，讓使用者接著挑底下的項目。
            if (needsSubcategory(categories, categoryId)) return;
            setPicker(null);
            setTarget({ kind: "category", categoryId });
          }}
        />
      </Modal>

      {/* 送出期間蓋住整張卡片：bulk 一次改幾十筆要跑一會兒，沒有這塊的話畫面完全沒有
          反應，使用者只能猜是不是當掉然後再按一次「完成」。 */}
      <BusyOverlay open={busy} label="修改中…" />
    </>
  );

  // 待確認狀態下工具列要講的細節：原本掛在哪幾個帳戶／哪幾個分類，以及這批橫跨的日期。
  // 本來這些話在確認彈窗裡，現在「完成」就是最後一關，話要留在按鈕旁邊看得到的地方。
  const originDetail =
    target?.kind === "account"
      ? originSummary(
          (t) => (t.accountId ? (accounts.find((a) => a.id === t.accountId)?.name ?? "（已刪除帳戶）") : "未指定"),
          (t) => (t.accountId ?? null) === target.accountId,
        )
      : target?.kind === "category"
        ? originSummary((t) => categoryPath(categories, t.categoryId) || "（已刪除分類）", (t) => t.categoryId === target.categoryId)
        : "";
  const spansMonths = sorted.length > 1 && sorted[0].date.slice(0, 7) !== sorted[sorted.length - 1].date.slice(0, 7);

  const pending: SelectionPending | undefined = target
    ? {
        summary: pendingSummary,
        detail: [
          originDetail ? `原本是：${originDetail}` : "",
          spansMonths ? `橫跨 ${formatDate(sorted[0].date)} ～ ${formatDate(sorted[sorted.length - 1].date)}` : "",
        ]
          .filter(Boolean)
          .join("・"),
        confirmLabel: `完成（${selectedIds.size} 筆）`,
        busy,
        onConfirm: apply,
        onCancel: () => setTarget(null),
      }
    : undefined;

  return { actions, pending, element };
}
