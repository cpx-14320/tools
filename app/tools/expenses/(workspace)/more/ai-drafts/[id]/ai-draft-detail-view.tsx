"use client";

import { useState } from "react";
import { PageHeader } from "@/components/expenses/page-header";
import { BackLink } from "@/components/expenses/back-link";
import { TransactionModal, type TransactionModalDraft } from "@/components/expenses/transaction-modal";
import { AiDraftList } from "@/components/expenses/ai/ai-draft-list";
import { text } from "@/components/expenses/theme";
import { unclassifiedItems, type AiDraftDTO, type AiDraftItemDTO } from "@/lib/expenses/ai-drafts";
import type { CategoryDTO } from "@/lib/expenses/categories";
import type { AccountDTO } from "@/lib/expenses/accounts";
import type { AccountTypeDTO } from "@/lib/expenses/account-types";
import type { TransactionDTO } from "@/lib/expenses/transactions";
import type { TransferDTO } from "@/lib/expenses/transfers";

/** 一批解析結果的詳情——看、調整、略過其中的每一筆。
 *
 *  **寫入不在這一頁**：統一在上一層（勾選批次 → 確認）。本來這裡有一顆「寫入 N 筆」，
 *  跟上一層的確認是同一件事卻用不同的字、放在不同的地方，使用者得記兩套；而且一批一批
 *  點進去寫，重跑過好幾次的時候要點很多輪。 */
export function AiDraftDetailView({
  initialDraft,
  initialCategories,
  accounts,
  accountTypes,
  transactions,
  transfers,
}: {
  initialDraft: AiDraftDTO;
  initialCategories: CategoryDTO[];
  accounts: AccountDTO[];
  accountTypes: AccountTypeDTO[];
  transactions: TransactionDTO[];
  transfers: TransferDTO[];
}) {
  const [draft, setDraft] = useState(initialDraft);
  // 分類可能在編輯彈窗裡被當場新增（CategoryGridPicker 有「＋ 新增」），所以要能就地更新。
  const [categories, setCategories] = useState(initialCategories);
  const [editing, setEditing] = useState<AiDraftItemDTO | null>(null);

  const unclassified = unclassifiedItems(draft);

  async function patchItem(key: string, patch: Record<string, unknown>) {
    const data: { draft?: AiDraftDTO } = await fetch("/api/expenses/ai/drafts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId: draft.id, key, ...patch }),
    })
      .then((r) => r.json())
      .catch(() => ({}));
    if (data.draft) setDraft(data.draft);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 這是第二層頁面，底部導覽的「設定」只回得到設定頁，回不到上一層的批次清單，
          所以標題列補一顆返回（跟帳戶明細頁同一顆 BackLink）。 */}
      <PageHeader
        flush
        title="待確認"
        actions={<BackLink href="/tools/expenses/more/ai-drafts" label="返回待確認清單" />}
      />

      {/* 小標就是當初打進去的那句話——使用者認得的是自己寫的字，不是日期或模型名稱。 */}
      <p className={text.sectionHeading}>「{draft.inputSummary}」</p>

      <AiDraftList
        draft={draft}
        categories={categories}
        onEdit={setEditing}
        onSkip={(item) => void patchItem(item.key, { state: "skipped" })}
      />

      {unclassified.length > 0 && (
        <p className="rounded-2xl bg-[#FDF4E7] px-4 py-3 text-xs leading-relaxed text-[#9A7430]">
          還有 {unclassified.length} 筆沒分類，點那一列補上之後才能寫入。不想記的話按「略過」。
        </p>
      )}

      {/* 編輯用的是記帳本原本那個新增／編輯彈窗（跟 AI 記帳彈窗裡同一個），分類、
          名稱、日期、金額、帳戶全都能改，而且值已經帶好。 */}
      <TransactionModal
        key={editing ? editing.key : "closed"}
        open={editing !== null}
        title="確認這一筆"
        confirmLabel="改好了"
        categories={categories}
        accounts={accounts}
        accountTypes={accountTypes}
        transactions={transactions}
        transfers={transfers}
        defaultKind="支出"
        initial={
          editing
            ? {
                // 沒分類就帶 AI 判到的大分類（見 ai-mock 的 hint）：CategoryGridPicker 會
                // 自動展開那一類的「項目」那一排，使用者點一下就好。
                categoryId: editing.categoryId ?? editing.categoryHintId ?? "",
                amount: editing.amount,
                date: editing.date,
                note: editing.note,
                accountId: editing.accountId,
              }
            : undefined
        }
        onClose={() => setEditing(null)}
        onSave={(next: TransactionModalDraft) => {
          if (editing) {
            void patchItem(editing.key, {
              categoryId: next.categoryId,
              amount: next.amount,
              date: next.date,
              note: next.note ?? null,
              accountId: next.accountId ?? null,
            });
          }
          setEditing(null);
        }}
        onCategoriesChange={setCategories}
      />
    </div>
  );
}
