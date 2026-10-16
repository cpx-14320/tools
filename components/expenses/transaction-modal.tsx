"use client";

import { useState } from "react";
import { Button, SegmentedControl } from "./button";
import { Modal, Field, fieldInputClass } from "./modal";
import { DateField } from "./date-field";
import { AccountPickerModal } from "./account-picker-modal";
import { CategoryGridPicker } from "./category-grid-picker";
import { CategoryBatchModal, type CategoryBatchItem } from "./category-batch-modal";
import { AmountKeypad, evaluateExpr } from "./amount-keypad";
import { categoryPath, type CategoryDTO, type CategoryKind } from "@/lib/expenses/categories";
import { breakdownNet, type BreakdownItem, type BreakdownKind, type TransactionDTO } from "@/lib/expenses/transactions";
import { type AccountDTO } from "@/lib/expenses/accounts";
import { accountTypeById, type AccountTypeDTO } from "@/lib/expenses/account-types";
import { type TransferDTO } from "@/lib/expenses/transfers";
import { formatCurrency } from "@/lib/format";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function blankBreakdownItem(): BreakdownItem {
  return { label: "", kind: "加項", amount: 0 };
}

export interface TransactionModalDraft {
  categoryId: string;
  amount: number;
  date: string;
  note?: string;
  breakdown?: BreakdownItem[];
  accountId?: string;
}

export function TransactionModal({
  open,
  categories,
  accounts,
  accountTypes,
  transactions,
  transfers,
  defaultKind,
  initial,
  onClose,
  onSave,
  onDelete,
  onCategoriesChange,
}: {
  open: boolean;
  categories: CategoryDTO[];
  accounts: AccountDTO[];
  accountTypes: AccountTypeDTO[];
  transactions: TransactionDTO[];
  transfers: TransferDTO[];
  defaultKind: CategoryKind;
  initial?: TransactionModalDraft;
  onClose: () => void;
  onSave: (draft: TransactionModalDraft) => void;
  onDelete?: () => void;
  /** 分類格子裡「＋新增」當場建好新分類後，把最新的分類清單回報給呼叫端更新自己的
   *  categories 狀態——不然關掉這個彈窗後分類列表又變回舊的。 */
  onCategoriesChange: (categories: CategoryDTO[]) => void;
}) {
  const initialCategory = initial ? categories.find((c) => c.id === initial.categoryId) : undefined;
  const [kind, setKind] = useState<CategoryKind>(initialCategory?.kind ?? defaultKind);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  // 金額改成跟參考圖一樣的內建小算盤——expr 是目前打在螢幕上的原始字串（例如
  // "120+45"），存草稿或儲存時才用 evaluateExpr 算出實際金額，不用另外開跳出式鍵盤。
  const [expr, setExpr] = useState(initial ? String(initial.amount) : "");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [note, setNote] = useState(initial?.note ?? "");
  const [accountId, setAccountId] = useState(initial?.accountId ?? "");
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [categoryBatchOpen, setCategoryBatchOpen] = useState(false);
  // 明細是依附在這筆交易上的輔助資訊（見 lib/expenses/transactions.ts 開頭的說明），平常
  // 大多數交易都不需要，預設收合成一般的單一金額輸入；只有使用者主動展開才出現逐項列表，
  // 這時金額欄位改成唯讀顯示明細加總，避免兩邊數字兜不起來。
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>(initial?.breakdown ?? []);
  const hasBreakdown = breakdown.length > 0;

  const breakdownTotal = hasBreakdown ? breakdownNet(breakdown) : 0;
  const amountNum = hasBreakdown ? breakdownTotal : evaluateExpr(expr);
  const breakdownValid = !hasBreakdown || breakdown.every((b) => b.label.trim() && Number.isFinite(b.amount) && b.amount > 0);
  const canSave = categoryId && Number.isFinite(amountNum) && amountNum > 0 && date && breakdownValid;

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const selectedAccountLabel = selectedAccount
    ? `${accountTypeById(accountTypes, selectedAccount.accountTypeId)?.icon ?? ""} ${selectedAccount.name}`
    : "";

  function updateBreakdownItem(index: number, patch: Partial<BreakdownItem>) {
    setBreakdown((list) => list.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeBreakdownItem(index: number) {
    setBreakdown((list) => list.filter((_, i) => i !== index));
  }

  // 逐筆依序 POST，理由跟帳戶類型／分類頁的批次新增一樣：新分類的 order 是用當下已存在
  // 筆數算出來的，併發送出會拿到同一個 order。建好之後直接選進這筆交易，不用使用者
  // 關掉彈窗後再手動點一次剛新增的分類。
  async function handleCreateCategories(items: CategoryBatchItem[]) {
    let latest = categories;
    let firstNewId: string | undefined;
    for (const item of items) {
      const data: { category?: CategoryDTO; categories?: CategoryDTO[] } = await fetch("/api/expenses/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (data.categories) {
        latest = data.categories;
        if (!firstNewId && data.category) firstNewId = data.category.id;
      }
    }
    onCategoriesChange(latest);
    if (firstNewId) setCategoryId(firstNewId);
    setCategoryBatchOpen(false);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "編輯消費紀錄" : "新增消費紀錄"}
      footer={
        <>
          {onDelete ? (
            <Button variant="ghost" className="text-[#D1517E] hover:text-[#D1517E]" onClick={onDelete}>
              刪除
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button
              disabled={!canSave}
              onClick={() =>
                onSave({
                  categoryId,
                  amount: amountNum,
                  date,
                  note: note.trim() || undefined,
                  breakdown: hasBreakdown ? breakdown : undefined,
                  accountId: accountId || undefined,
                })
              }
            >
              儲存
            </Button>
          </div>
        </>
      }
    >
      <SegmentedControl
        fullWidth
        size="lg"
        value={kind}
        onChange={(k) => {
          setKind(k);
          setCategoryId("");
        }}
        options={[
          { value: "支出", label: "支出" },
          { value: "收入", label: "收入" },
        ]}
      />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-[#9C94C4]">分類</span>
          {categoryId && <span className="text-xs font-medium text-[#4A3B7C]">{categoryPath(categories, categoryId)}</span>}
        </div>
        {/* 只有這一塊自己捲動——分類一多，捲的是這個格子區塊，不是整個彈窗（彈窗本身的
            標題／底部按鈕已經固定不動，見 modal.tsx）。 */}
        <CategoryGridPicker categories={categories} kind={kind} value={categoryId} onChange={setCategoryId} onAddClick={() => setCategoryBatchOpen(true)} />
      </div>

      <Field label="日期">
        <DateField value={date} onChange={setDate} />
      </Field>
      <Field label="帳戶（可不填）">
        <button
          type="button"
          onClick={() => setAccountPickerOpen(true)}
          className={`${fieldInputClass} flex items-center justify-between gap-2 text-left`}
        >
          <span className={selectedAccount ? "text-[#4A3B7C]" : "text-[#B3ABD4]"}>{selectedAccount ? selectedAccountLabel : "不指定帳戶"}</span>
          <span aria-hidden className="shrink-0 text-[#9C94C4]">
            🏦
          </span>
        </button>
      </Field>
      <Field label="備註（可不填）">
        <input value={note} onChange={(e) => setNote(e.target.value)} className={fieldInputClass} />
      </Field>

      {hasBreakdown ? (
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-medium text-[#9C94C4]">明細（例如薪資的本薪／加班費／勞保／所得稅）</span>
          {breakdown.map((item, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-2xl border border-[#ECE4FA] p-3">
              <div className="flex items-center gap-2">
                <input
                  value={item.label}
                  onChange={(e) => updateBreakdownItem(i, { label: e.target.value })}
                  placeholder="例如「本薪」「勞保費」"
                  className={`${fieldInputClass} flex-1`}
                />
                <button type="button" onClick={() => removeBreakdownItem(i)} className="shrink-0 text-xs font-medium text-[#D1517E]">
                  刪除
                </button>
              </div>
              <div className="flex items-center gap-2">
                <SegmentedControl
                  value={item.kind}
                  onChange={(v: BreakdownKind) => updateBreakdownItem(i, { kind: v })}
                  options={[
                    { value: "加項", label: "加項" },
                    { value: "扣項", label: "扣項" },
                  ]}
                />
                <input
                  type="number"
                  min={1}
                  value={item.amount || ""}
                  onChange={(e) => updateBreakdownItem(i, { amount: Number(e.target.value) })}
                  placeholder="金額"
                  className={`${fieldInputClass} flex-1`}
                />
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setBreakdown((list) => [...list, blankBreakdownItem()])}
              className="rounded-xl border border-dashed border-[#C7BFE6] px-4 py-2 text-xs font-medium text-[#6F5FD6]"
            >
              ＋ 新增明細項目
            </button>
            <button type="button" onClick={() => setBreakdown([])} className="text-xs font-medium text-[#9C94C4] hover:text-[#D1517E]">
              移除全部明細
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setBreakdown([blankBreakdownItem()])}
          className="self-start text-xs font-medium text-[#6F5FD6] hover:underline"
        >
          ＋ 新增明細（這筆錢想拆成好幾個加項/扣項時再用）
        </button>
      )}

      {/* 金額跟鍵盤放在最下面——跟其他欄位比起來，這是使用者填完前面所有欄位後最後
          才會操作的區塊，鍵盤本身也最高，放最下面才不會把下面的欄位往下推。 */}
      {hasBreakdown ? (
        <Field label="金額（由下方明細加總算出）">
          <div className={`${fieldInputClass} font-semibold`}>{formatCurrency(breakdownTotal)}</div>
        </Field>
      ) : (
        <AmountKeypad expr={expr} onExprChange={setExpr} color={kind === "收入" ? "#2FAE82" : "#D1517E"} />
      )}

      <AccountPickerModal
        open={accountPickerOpen}
        accounts={accounts}
        accountTypes={accountTypes}
        transactions={transactions}
        categories={categories}
        transfers={transfers}
        value={accountId || undefined}
        onClose={() => setAccountPickerOpen(false)}
        onSelect={(id) => setAccountId(id ?? "")}
      />
      <CategoryBatchModal
        open={categoryBatchOpen}
        isSubcategory={false}
        categories={categories}
        defaultKind={kind}
        onClose={() => setCategoryBatchOpen(false)}
        onSave={handleCreateCategories}
      />
    </Modal>
  );
}
