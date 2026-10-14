"use client";

import { useState } from "react";
import { Button, SegmentedControl } from "./button";
import { Modal, Field, fieldInputClass } from "./modal";
import { DateField } from "./date-field";
import { topLevelCategories, subCategoriesOf, type CategoryDTO, type CategoryKind } from "@/lib/expenses/categories";
import { breakdownNet, type BreakdownItem, type BreakdownKind } from "@/lib/expenses/transactions";
import { accountsByKind, type AccountDTO } from "@/lib/expenses/accounts";
import { accountTypeById, type AccountTypeDTO } from "@/lib/expenses/account-types";
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
  defaultKind,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  categories: CategoryDTO[];
  accounts: AccountDTO[];
  accountTypes: AccountTypeDTO[];
  defaultKind: CategoryKind;
  initial?: TransactionModalDraft;
  onClose: () => void;
  onSave: (draft: TransactionModalDraft) => void;
  onDelete?: () => void;
}) {
  const initialCategory = initial ? categories.find((c) => c.id === initial.categoryId) : undefined;
  const [kind, setKind] = useState<CategoryKind>(initialCategory?.kind ?? defaultKind);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [note, setNote] = useState(initial?.note ?? "");
  const [accountId, setAccountId] = useState(initial?.accountId ?? "");
  // 明細是依附在這筆交易上的輔助資訊（見 lib/expenses/transactions.ts 開頭的說明），平常
  // 大多數交易都不需要，預設收合成一般的單一金額輸入；只有使用者主動展開才出現逐項列表，
  // 這時金額欄位改成唯讀顯示明細加總，避免兩邊數字兜不起來。
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>(initial?.breakdown ?? []);
  const hasBreakdown = breakdown.length > 0;

  const breakdownTotal = hasBreakdown ? breakdownNet(breakdown) : 0;
  const amountNum = hasBreakdown ? breakdownTotal : Number(amount);
  const breakdownValid = !hasBreakdown || breakdown.every((b) => b.label.trim() && Number.isFinite(b.amount) && b.amount > 0);
  const canSave = categoryId && Number.isFinite(amountNum) && amountNum > 0 && date && breakdownValid;

  const options: { id: string; label: string }[] = [];
  for (const parent of topLevelCategories(categories, kind)) {
    options.push({ id: parent.id, label: `${parent.icon} ${parent.name}` });
    for (const sub of subCategoriesOf(categories, parent.id)) {
      options.push({ id: sub.id, label: `　↳ ${sub.icon} ${sub.name}` });
    }
  }

  const assetAccounts = accountsByKind(accounts, accountTypes, "asset");
  const liabilityAccounts = accountsByKind(accounts, accountTypes, "liability");
  const accountLabel = (a: AccountDTO) => `${accountTypeById(accountTypes, a.accountTypeId)?.icon ?? ""} ${a.name}`;

  function updateBreakdownItem(index: number, patch: Partial<BreakdownItem>) {
    setBreakdown((list) => list.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeBreakdownItem(index: number) {
    setBreakdown((list) => list.filter((_, i) => i !== index));
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
      <Field label="收支類型">
        <SegmentedControl
          className="self-start"
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
      </Field>
      <Field label="分類">
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={fieldInputClass}>
          <option value="" disabled>
            選擇分類
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      {hasBreakdown ? (
        <Field label="金額（由下方明細加總算出）">
          <div className={`${fieldInputClass} font-semibold`}>{formatCurrency(breakdownTotal)}</div>
        </Field>
      ) : (
        <Field label="金額">
          <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className={fieldInputClass} />
        </Field>
      )}

      <Field label="日期">
        <DateField value={date} onChange={setDate} />
      </Field>
      <Field label="備註（可不填）">
        <input value={note} onChange={(e) => setNote(e.target.value)} className={fieldInputClass} />
      </Field>
      <Field label="帳戶（可不填）">
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={fieldInputClass}>
          <option value="">不指定帳戶</option>
          {assetAccounts.length > 0 && (
            <optgroup label="資產">
              {assetAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {accountLabel(a)}
                </option>
              ))}
            </optgroup>
          )}
          {liabilityAccounts.length > 0 && (
            <optgroup label="負債">
              {liabilityAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {accountLabel(a)}
                </option>
              ))}
            </optgroup>
          )}
        </select>
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
    </Modal>
  );
}
