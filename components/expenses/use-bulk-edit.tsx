"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "./modal";
import { AccountPickerModal } from "./account-picker-modal";
import { CategoryGridPicker } from "./category-grid-picker";
import { ConfirmModal } from "./confirm-modal";
import { useToast } from "./toast";
import type { SelectionAction } from "./selection-bar";
import { categoryPath, needsSubcategory, type CategoryDTO, type CategoryKind } from "@/lib/expenses/categories";
import type { TransactionDTO } from "@/lib/expenses/transactions";
import type { AccountDTO } from "@/lib/expenses/accounts";
import type { AccountTypeDTO } from "@/lib/expenses/account-types";
import type { TransferDTO } from "@/lib/expenses/transfers";
import { formatDate } from "@/lib/format";

/** 多選之後「改帳戶／改分類」的那一整套：工具列上的兩顆按鈕、挑目標的彈窗、確認彈窗、
 *  送出。明細頁跟帳戶明細頁共用同一份——兩邊列的都是交易，操作當然該一模一樣。
 *
 *  回傳 `actions` 給 SelectionBar、`element` 放在畫面任何地方（裡面是三個彈窗，用
 *  createPortal 掛到 body，所以擺哪裡都不影響版面）。呼叫端只要兩行。
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
}): { actions: SelectionAction[]; element: ReactNode } {
  const showToast = useToast();
  // 先開選擇彈窗挑目標，挑完存進 bulkTarget、換成確認彈窗，按下去才真的改。分兩步是
  // 因為「改 23 筆」按錯了要一筆一筆救回來，中間一定要有一次看得到筆數跟去向的確認。
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
    { label: "改帳戶", onClick: () => setPicker("account") },
    {
      label: "改分類",
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
        title="改掛到哪個帳戶"
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
      <Modal open={picker === "category" && kind !== null} onClose={() => setPicker(null)} title="改成哪個分類" fullHeight>
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

      {/* 改之前的最後一關。標題講「改成什麼」、內文講「有幾筆、原本是什麼」——原本就
          已經是目標值的那幾筆不列。不用紅色的破壞性樣式：這是補資料，不是刪資料。 */}
      <ConfirmModal
        open={target !== null}
        title={targetName}
        danger={false}
        message={
          <>
            選取的 {selectedIds.size} 筆紀錄會{target?.kind === "account" ? "改掛到這個帳戶" : "改成這個分類"}。
            {target?.kind === "account" &&
              (() => {
                const origins = originSummary(
                  (t) => (t.accountId ? (accounts.find((a) => a.id === t.accountId)?.name ?? "（已刪除帳戶）") : "未指定"),
                  (t) => (t.accountId ?? null) === target.accountId,
                );
                return origins ? <span className="mt-2 block">其中原本掛在：{origins}，都會一起改掉。帳戶餘額會跟著重算。</span> : null;
              })()}
            {target?.kind === "category" &&
              (() => {
                const origins = originSummary(
                  (t) => categoryPath(categories, t.categoryId) || "（已刪除分類）",
                  (t) => t.categoryId === target.categoryId,
                );
                return origins ? <span className="mt-2 block">原本的分類（{origins}）會被取代。</span> : null;
              })()}
            {/* 選到的橫跨不只一個月時講明白——畫面上一次看不到那麼多，容易以為只改了眼前這些。 */}
            {sorted.length > 1 && sorted[0].date.slice(0, 7) !== sorted[sorted.length - 1].date.slice(0, 7) && (
              <span className="mt-2 block">
                這批紀錄橫跨 {formatDate(sorted[0].date)} ～ {formatDate(sorted[sorted.length - 1].date)}。
              </span>
            )}
          </>
        }
        confirmLabel={busy ? "處理中…" : `${target?.kind === "account" ? "改掛" : "改成"} ${selectedIds.size} 筆`}
        onConfirm={apply}
        onClose={() => setTarget(null)}
      />
    </>
  );

  return { actions, element };
}
