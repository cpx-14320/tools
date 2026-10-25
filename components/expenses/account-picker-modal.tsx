"use client";

import { Modal } from "./modal";
import { IconAvatar } from "./icon-avatar";
import { accountsByKind, accountBalance, type AccountDTO } from "@/lib/expenses/accounts";
import { accountTypeById, type AccountTypeDTO } from "@/lib/expenses/account-types";
import { type CategoryDTO } from "@/lib/expenses/categories";
import { type TransactionDTO } from "@/lib/expenses/transactions";
import { type TransferDTO } from "@/lib/expenses/transfers";
import { formatCurrency } from "@/lib/format";

/** 交易彈窗點「帳戶」欄位跳出的第二層彈窗——取代原本的原生 `<select>`，比照資產總表
 *  的列表樣式（圖示＋名稱＋目前餘額），選了直接關窗帶回選到的帳戶 id，不用再按一次
 *  確認。這是整個新增交易流程裡唯一允許的「第二層」彈窗，分類／金額都做在主彈窗
 *  裡直接選、不再另外跳窗。轉帳彈窗（TransferModal）的轉出/轉入帳戶選擇也共用這個
 *  元件，`excludeAccountId` 讓「轉入」那邊不會列出已經選成「轉出」的那個帳戶。 */
export function AccountPickerModal({
  open,
  title = "選擇帳戶",
  accounts,
  accountTypes,
  transactions = [],
  categories = [],
  transfers = [],
  showBalance = true,
  value,
  excludeAccountId,
  allowUnset = true,
  unsetLabel = "不指定帳戶",
  onClose,
  onSelect,
}: {
  open: boolean;
  title?: string;
  accounts: AccountDTO[];
  accountTypes: AccountTypeDTO[];
  /** 只有要顯示餘額時才需要這三份資料（餘額是從期初餘額加上所有交易／轉帳算出來的，
   *  見 accounts.ts 的 accountBalance）。showBalance 關掉時可以全部省略。 */
  transactions?: TransactionDTO[];
  categories?: CategoryDTO[];
  transfers?: TransferDTO[];
  /** 列出餘額。記一筆帳時「這個戶頭還有多少」是選帳戶的依據，所以預設顯示；但在分類設定
   *  裡挑「預設帳戶」時問的是「這類支出習慣從哪裡出」，跟當下餘額無關，列出來反而要那一頁
   *  多撈交易與轉帳的全部資料，只為了一行用不到的數字。 */
  showBalance?: boolean;
  value?: string;
  /** 轉帳彈窗選「轉入」帳戶時，排除已經選成「轉出」的那個帳戶（反之亦然），不讓使用者
   *  選到同一個帳戶。 */
  excludeAccountId?: string;
  /** 一般交易的帳戶可以不指定；轉帳的轉出/轉入帳戶都必填，不給「不指定帳戶」這個選項。 */
  allowUnset?: boolean;
  /** 「不指定」那一列的字——分類設定的「預設帳戶」講的是「不設預設」，不是這筆帳沒有帳戶。 */
  unsetLabel?: string;
  onClose: () => void;
  onSelect: (accountId: string | undefined) => void;
}) {
  const visibleAccounts = accounts.filter((a) => a.id !== excludeAccountId);
  const assets = accountsByKind(visibleAccounts, accountTypes, "asset");
  const liabilities = accountsByKind(visibleAccounts, accountTypes, "liability");

  function choose(accountId: string | undefined) {
    onSelect(accountId);
    onClose();
  }

  function Row({ account }: { account: AccountDTO }) {
    const type = accountTypeById(accountTypes, account.accountTypeId);
    const selected = value === account.id;
    return (
      <button
        type="button"
        onClick={() => choose(account.id)}
        className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors ${
          selected ? "border-[#6F5FD6] bg-[#F3EFFC]" : "border-[#ECE4FA] bg-white"
        }`}
      >
        <IconAvatar icon={type?.icon ?? "❓"} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-[#4A3B7C]">{account.name}</span>
          {showBalance && (
            <span className="block text-xs tabular-nums text-[#9C94C4]">
              {formatCurrency(accountBalance(account, accountTypes, transactions, categories, transfers))}
            </span>
          )}
        </span>
        {selected && (
          <span aria-hidden className="shrink-0 text-[#6F5FD6]">
            ✓
          </span>
        )}
      </button>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-2">
        {allowUnset && (
          <button
            type="button"
            onClick={() => choose(undefined)}
            className={`w-full rounded-2xl border px-3 py-3 text-left text-sm ${
              !value ? "border-[#6F5FD6] bg-[#F3EFFC] font-medium text-[#4A3B7C]" : "border-[#ECE4FA] bg-white text-[#9C94C4]"
            }`}
          >
            {unsetLabel}
          </button>
        )}

        {assets.length > 0 && (
          <>
            <p className="mt-1 px-1 text-xs font-medium text-[#9C94C4]">資產</p>
            {assets.map((a) => (
              <Row key={a.id} account={a} />
            ))}
          </>
        )}

        {liabilities.length > 0 && (
          <>
            <p className="mt-1 px-1 text-xs font-medium text-[#9C94C4]">負債</p>
            {liabilities.map((a) => (
              <Row key={a.id} account={a} />
            ))}
          </>
        )}
      </div>
    </Modal>
  );
}
