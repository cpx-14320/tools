"use client";

import { useState } from "react";
import { SegmentedControl } from "./button";
import { Modal, Field, fieldInputClass, ModalFooter } from "./modal";
import { DateField } from "./date-field";
import { AccountPickerModal } from "./account-picker-modal";
import { CategoryGridPicker } from "./category-grid-picker";
import { CategoryBatchModal, type CategoryBatchItem } from "./category-batch-modal";
import { AmountKeypad, evaluateExpr } from "./amount-keypad";
import { InlineIcon } from "./icon-avatar";
import { text } from "./theme";
import { categoryById, categoryPath, type CategoryDTO, type CategoryKind } from "@/lib/expenses/categories";
import { breakdownNet, frequentCombos, type BreakdownItem, type BreakdownKind, type TransactionDTO } from "@/lib/expenses/transactions";
import { type AccountDTO } from "@/lib/expenses/accounts";
import { accountTypeById, type AccountTypeDTO } from "@/lib/expenses/account-types";
import { type TransferDTO } from "@/lib/expenses/transfers";
import { formatCurrency } from "@/lib/format";

/** 本地日期（不是 UTC）——toISOString() 在台灣時區的凌晨會回到前一天。 */
function localISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const todayISO = () => localISO(0);
const yesterdayISO = () => localISO(-1);

function blankBreakdownItem(): BreakdownItem {
  return { label: "", kind: "加項", amount: 0 };
}

/** 底部小鍵盤現在在編哪一個欄位——交易本身的金額，或是某一個明細項目的金額。 */
type KeypadTarget = { kind: "amount" } | { kind: "breakdown"; index: number };

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
  // 金額用彈窗底部那個固定不動的內建小算盤輸入——amountExpr 是目前打在螢幕上的原始
  // 字串（例如 "120+45"），儲存時才用 evaluateExpr 算出實際金額。
  const [amountExpr, setAmountExpr] = useState(initial ? String(initial.amount) : "");
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

  // 底部那個小鍵盤同時服務「這筆交易的金額」跟「某一個明細項目的金額」：target 記錄
  // 現在在編哪一個，scratchExpr 是編明細時的暫存字串（明細本身存的是數字，不是算式）。
  const [target, setTarget] = useState<KeypadTarget>({ kind: "amount" });
  const [scratchExpr, setScratchExpr] = useState("");
  // 帳戶／備註／明細收在「更多」裡：絕大多數的紀錄只要分類＋金額＋日期，三個欄位攤開
  // 擺著只會把分類格子跟鍵盤擠到要捲動才看得到。編輯既有紀錄時，那筆本來就有填這幾欄
  // 的話預設展開，不然會以為資料不見了。
  const [moreOpen, setMoreOpen] = useState(
    () => !!initial && (!!initial.accountId || !!initial.note || (initial.breakdown?.length ?? 0) > 0),
  );

  const breakdownTotal = hasBreakdown ? breakdownNet(breakdown) : 0;
  const amountNum = hasBreakdown ? breakdownTotal : evaluateExpr(amountExpr);
  const breakdownValid = !hasBreakdown || breakdown.every((b) => b.label.trim() && Number.isFinite(b.amount) && b.amount > 0);
  const canSave = categoryId && Number.isFinite(amountNum) && amountNum > 0 && date && breakdownValid;

  const combos = frequentCombos(transactions, categories, kind);
  const selectedAccount = accounts.find((a) => a.id === accountId);
  const selectedAccountIcon = selectedAccount ? (accountTypeById(accountTypes, selectedAccount.accountTypeId)?.icon ?? "") : "";

  // 編到一半的明細項目被刪掉時，鍵盤要退回編交易金額，不然 target.index 會指向不存在
  // 的項目（或指到被往前遞補的另一筆，改到不該改的地方）。
  const activeBreakdownIndex = target.kind === "breakdown" && target.index < breakdown.length ? target.index : null;
  const keypadExpr = activeBreakdownIndex === null ? amountExpr : scratchExpr;
  // 一般情況不給標題（鍵盤上面就是一個大大的 NT$ 金額，再寫一次「金額」是多餘的）；
  // 只有在「金額是明細加總出來的」或「正在編某一筆明細」這兩種需要解釋的情況才標。
  const keypadLabel =
    activeBreakdownIndex === null
      ? hasBreakdown
        ? "金額（由明細加總算出，點下方明細項目修改）"
        : undefined
      : `明細：${breakdown[activeBreakdownIndex].label.trim() || `第 ${activeBreakdownIndex + 1} 項`}`;

  function handleKeypadChange(next: string) {
    if (activeBreakdownIndex === null) {
      setAmountExpr(next);
      return;
    }
    setScratchExpr(next);
    updateBreakdownItem(activeBreakdownIndex, { amount: evaluateExpr(next) });
  }

  function focusBreakdownAmount(index: number) {
    setScratchExpr(breakdown[index]?.amount ? String(breakdown[index].amount) : "");
    setTarget({ kind: "breakdown", index });
  }

  function updateBreakdownItem(index: number, patch: Partial<BreakdownItem>) {
    setBreakdown((list) => list.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeBreakdownItem(index: number) {
    setBreakdown((list) => list.filter((_, i) => i !== index));
    setTarget({ kind: "amount" });
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
      fullHeight
      // 小鍵盤固定在彈窗最下面不跟著捲動，使用者可以一邊捲上面的分類／日期／帳戶，
      // 一邊隨時按數字；按明細項目的金額時這個鍵盤會改成編那一項（見 keypadLabel）。
      stickyBottom={<AmountKeypad expr={keypadExpr} onExprChange={handleKeypadChange} color={kind === "收入" ? "#2FAE82" : "#D1517E"} label={keypadLabel} />}
      footer={
        <ModalFooter
          onClose={onClose}
          onConfirm={() =>
            onSave({
              categoryId,
              amount: amountNum,
              date,
              note: note.trim() || undefined,
              breakdown: hasBreakdown ? breakdown : undefined,
              accountId: accountId || undefined,
            })
          }
          confirmDisabled={!canSave}
          onDelete={onDelete}
        />
      }
    >
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

      {/* 常用組合置頂：從最近的紀錄統計出最常用的「分類＋帳戶」，點一下兩欄一起填好，
          只有編輯既有紀錄時不顯示（那時候欄位本來就有值，再推薦只會誤觸）。 */}
      {!initial && combos.length > 0 && (
        <div>
          <span className="text-xs font-medium text-[#9C94C4]">常用</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {combos.map((combo) => {
              const cat = categoryById(categories, combo.categoryId);
              const acc = combo.accountId ? accounts.find((a) => a.id === combo.accountId) : undefined;
              if (!cat) return null;
              const active = categoryId === combo.categoryId && (combo.accountId ?? "") === accountId;
              return (
                <button
                  key={`${combo.categoryId}|${combo.accountId ?? ""}`}
                  type="button"
                  onClick={() => {
                    setCategoryId(combo.categoryId);
                    setAccountId(combo.accountId ?? "");
                  }}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active ? "border-[#6F5FD6] bg-[#6F5FD6] text-white" : "border-[#ECE4FA] bg-white text-[#4A3B7C]"
                  }`}
                >
                  <InlineIcon icon={cat.icon} className="size-3.5" />
                  <span>{cat.name}</span>
                  {acc && <span className={active ? "text-white/70" : "text-[#9C94C4]"}>· {acc.name}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-[#9C94C4]">分類</span>
          {categoryId && <span className="text-xs font-medium text-[#4A3B7C]">{categoryPath(categories, categoryId)}</span>}
        </div>
        {/* 只有這一塊自己捲動——分類一多，捲的是這個格子區塊，不是整個彈窗（彈窗本身的
            標題／底部按鈕已經固定不動，見 modal.tsx）。 */}
        <CategoryGridPicker categories={categories} kind={kind} value={categoryId} onChange={setCategoryId} onAddClick={() => setCategoryBatchOpen(true)} />
      </div>

      {/* 記帳絕大多數是記「今天」或「昨天剛花的」，這兩顆直接點比開日期選擇器快很多；
          要記更早的日期才需要開選擇器。選中的那顆會反白，看得出現在是哪一天。 */}
      <Field label="日期">
        <div className="flex items-center gap-2">
          <DateField value={date} onChange={setDate} className="min-w-0 flex-1" />
          {/* 直接用 SegmentedControl（跟收支類型同一個元件）：value 傳目前的日期，挑了
              更早的日期時兩顆都不會亮，剛好就是「今天／昨天都不是」該有的樣子。 */}
          <SegmentedControl
            className="shrink-0"
            value={date}
            onChange={setDate}
            options={[
              { value: todayISO(), label: "今天" },
              { value: yesterdayISO(), label: "昨天" },
            ]}
          />
        </div>
      </Field>
      {!moreOpen && (
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="self-start text-xs font-medium text-[#6F5FD6] hover:underline"
        >
          ＋ 更多（帳戶、備註、明細）
        </button>
      )}

      {moreOpen && (
        <>
          <Field label="帳戶（可不填）">
            <button type="button" onClick={() => setAccountPickerOpen(true)} className={`${fieldInputClass} text-left`}>
              <span className={`flex items-center gap-1.5 ${selectedAccount ? "text-[#4A3B7C]" : "text-[#B3ABD4]"}`}>
                {selectedAccountIcon && <InlineIcon icon={selectedAccountIcon} />}
                {selectedAccount ? selectedAccount.name : "不指定帳戶"}
              </span>
            </button>
          </Field>
          <Field label="備註（可不填）">
            <input value={note} onChange={(e) => setNote(e.target.value)} className={fieldInputClass} />
          </Field>
        </>
      )}

      {moreOpen &&
        (hasBreakdown ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className={text.label}>明細（例如薪資的本薪／加班費／勞保／所得稅）</span>
            <span className="text-sm font-semibold tabular-nums text-[#4A3B7C]">淨額 {formatCurrency(breakdownTotal)}</span>
          </div>
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
                {/* 金額一律用下面那個固定的小鍵盤輸入，不開手機原生數字鍵盤——點這裡
                    只是把鍵盤的編輯對象切到這一項。 */}
                <button
                  type="button"
                  onClick={() => focusBreakdownAmount(i)}
                  className={`${fieldInputClass} flex-1 text-left tabular-nums ${
                    activeBreakdownIndex === i ? "border-[#6F5FD6] bg-[#F9F7FE]" : ""
                  }`}
                >
                  <span className={item.amount ? "text-[#4A3B7C]" : "text-[#B3ABD4]"}>
                    {item.amount ? formatCurrency(item.amount) : "點這裡用下方鍵盤輸入"}
                  </span>
                </button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setBreakdown((list) => [...list, blankBreakdownItem()]);
                setScratchExpr("");
                setTarget({ kind: "breakdown", index: breakdown.length });
              }}
              className="rounded-xl border border-dashed border-[#C7BFE6] px-4 py-2 text-xs font-medium text-[#6F5FD6]"
            >
              ＋ 新增明細項目
            </button>
            <button
              type="button"
              onClick={() => {
                setBreakdown([]);
                setTarget({ kind: "amount" });
              }}
              className="text-xs font-medium text-[#9C94C4] hover:text-[#D1517E]"
            >
              移除全部明細
            </button>
          </div>
        </div>
      ) : (
          <button
            type="button"
            onClick={() => {
              setBreakdown([blankBreakdownItem()]);
              setScratchExpr("");
              setTarget({ kind: "breakdown", index: 0 });
            }}
            className="self-start text-xs font-medium text-[#6F5FD6] hover:underline"
          >
            ＋ 新增明細（這筆錢想拆成好幾個加項/扣項時再用）
          </button>
        ))}

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
        lockedKind={kind}
        onClose={() => setCategoryBatchOpen(false)}
        onSave={handleCreateCategories}
      />
    </Modal>
  );
}
