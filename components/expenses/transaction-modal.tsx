"use client";

import { useState } from "react";
import { SegmentedControl } from "./button";
import { Modal, Field, fieldInputClass, ModalFooter } from "./modal";
import { SelectField } from "./select-field";
import { DateField } from "./date-field";
import { AccountPickerModal } from "./account-picker-modal";
import { CategoryGridPicker } from "./category-grid-picker";
import { CategoryBatchModal, type CategoryBatchItem } from "./category-batch-modal";
import { AmountKeypad, evaluateExpr } from "./amount-keypad";
import { text } from "./theme";
import { categoryPath, defaultAccountForCategory, needsSubcategory, type CategoryDTO, type CategoryKind } from "@/lib/expenses/categories";
import { breakdownNet, type BreakdownItem, type BreakdownKind, type TransactionDTO } from "@/lib/expenses/transactions";
import { type AccountDTO } from "@/lib/expenses/accounts";
import { type AccountTypeDTO } from "@/lib/expenses/account-types";
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
  // 使用者自己動過帳戶欄之後就不要再自動覆蓋——選分類帶出來的只是預設值，不是鎖定。
  const [accountTouched, setAccountTouched] = useState(!!initial?.accountId);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [categoryBatchOpen, setCategoryBatchOpen] = useState(false);
  // 「項目」那一排的「＋ 新增」要補的是哪個大分類底下的子項目——空字串代表沒在新增。
  const [subBatchParentId, setSubBatchParentId] = useState("");
  // 明細是依附在這筆交易上的輔助資訊（見 lib/expenses/transactions.ts 開頭的說明），平常
  // 大多數交易都不需要，預設收合成一般的單一金額輸入；只有使用者主動展開才出現逐項列表，
  // 這時金額欄位改成唯讀顯示明細加總，避免兩邊數字兜不起來。
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>(initial?.breakdown ?? []);
  const hasBreakdown = breakdown.length > 0;

  // 底部那個小鍵盤同時服務「這筆交易的金額」跟「某一個明細項目的金額」：target 記錄
  // 現在在編哪一個，scratchExpr 是編明細時的暫存字串（明細本身存的是數字，不是算式）。
  const [target, setTarget] = useState<KeypadTarget>({ kind: "amount" });
  const [scratchExpr, setScratchExpr] = useState("");

  const breakdownTotal = hasBreakdown ? breakdownNet(breakdown) : 0;
  const amountNum = hasBreakdown ? breakdownTotal : evaluateExpr(amountExpr);
  const breakdownValid = !hasBreakdown || breakdown.every((b) => b.label.trim() && Number.isFinite(b.amount) && b.amount > 0);
  // 有子分類的大分類只是個殼，一定要挑到底下的項目才算選好（見 needsSubcategory）。
  const canSave =
    categoryId && !needsSubcategory(categories, categoryId) && Number.isFinite(amountNum) && amountNum > 0 && date && breakdownValid;

  const selectedAccount = accounts.find((a) => a.id === accountId);

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

  /** 選分類時連帶把帳戶帶出來。
   *
   *  同一個分類的錢幾乎都是從同一個帳戶出（吃飯刷同一張卡、房租固定從某個戶頭扣），
   *  每記一筆都要再挑一次帳戶是多餘的一步。預設值設在主分類上（見 categories.ts 的
   *  defaultAccountForCategory），子分類沿用。使用者自己改過帳戶就不再覆蓋。 */
  function chooseCategory(id: string, list: CategoryDTO[] = categories) {
    setCategoryId(id);
    if (accountTouched) return;
    const preset = defaultAccountForCategory(list, id);
    setAccountId(preset ?? "");
  }

  // 逐筆依序 POST，理由跟帳戶類型／分類頁的批次新增一樣：新分類的 order 是用當下已存在
  // 筆數算出來的，併發送出會拿到同一個 order。建好之後直接選進這筆交易，不用使用者
  // 關掉彈窗後再手動點一次剛新增的分類。
  async function handleCreateCategories(items: CategoryBatchItem[], parentId?: string) {
    let latest = categories;
    let firstNewId: string | undefined;
    for (const item of items) {
      const data: { category?: CategoryDTO; categories?: CategoryDTO[] } = await fetch("/api/expenses/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parentId ? { ...item, parentId } : item),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (data.categories) {
        latest = data.categories;
        if (!firstNewId && data.category) firstNewId = data.category.id;
      }
    }
    onCategoriesChange(latest);
    // 新增完直接選起來：剛補的子項目十之八九就是這筆要記的那一個，還要再點一次是多的。
    // 這裡要用 latest 而不是 categories——setState 要等重繪才生效，chooseCategory 裡面
    // 的 defaultAccountForCategory 這一刻在舊的清單裡找不到剛建好的分類。
    if (firstNewId) chooseCategory(firstNewId, latest);
    setCategoryBatchOpen(false);
    setSubBatchParentId("");
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "編輯消費紀錄" : "新增消費紀錄"}
      fullHeight
      // 小鍵盤固定在彈窗最下面不跟著捲動，使用者可以一邊捲上面的分類／日期／帳戶，
      // 一邊隨時按數字；按明細項目的金額時這個鍵盤會改成編那一項（見 keypadLabel）。
      stickyBottom={<AmountKeypad expr={keypadExpr} onExprChange={handleKeypadChange} label={keypadLabel} />}
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

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-[#9C94C4]">分類</span>
          {categoryId && <span className="text-xs font-medium text-[#4A3B7C]">{categoryPath(categories, categoryId)}</span>}
        </div>
        {/* 只有這一塊自己捲動——分類一多，捲的是這個格子區塊，不是整個彈窗（彈窗本身的
            標題／底部按鈕已經固定不動，見 modal.tsx）。 */}
        <CategoryGridPicker
          categories={categories}
          kind={kind}
          value={categoryId}
          onChange={chooseCategory}
          onAddClick={() => setCategoryBatchOpen(true)}
          onAddSubClick={setSubBatchParentId}
        />
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
      {/* 帳戶跟備註直接攤開，不再收在「＋ 更多」裡：帳戶幾乎每一筆都要選，多一次展開
          等於每記一筆就多按一下。只有明細維持收合——那是薪資那種少數情況才用的東西。 */}
          <Field label="帳戶（可不填）">
            {/* 只有名稱、不放類型圖示：這一欄顯示的是「哪一個帳戶」，圖示是帳戶類型的，
                同一種類型底下好幾個帳戶會掛同一張圖，分辨不出任何東西。 */}
            <SelectField value={selectedAccount?.name} placeholder="不指定帳戶" onClick={() => setAccountPickerOpen(true)} />
          </Field>
          <Field label="備註（可不填）">
            <input value={note} onChange={(e) => setNote(e.target.value)} className={fieldInputClass} />
          </Field>

      {hasBreakdown ? (
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
            ＋ 新增明細
          </button>
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
        onSelect={(id) => {
          setAccountId(id ?? "");
          setAccountTouched(true);
        }}
      />
      <CategoryBatchModal
        open={categoryBatchOpen}
        isSubcategory={false}
        categories={categories}
        lockedKind={kind}
        onClose={() => setCategoryBatchOpen(false)}
        onSave={handleCreateCategories}
      />
      {/* 「項目」那排的「＋ 新增」開的是同一個批次彈窗，只是 isSubcategory／parentId 不同。
          key 綁 parentId：換一個大分類再開時要是全新的空白草稿，不是上一個分類沒存完的殘留。 */}
      <CategoryBatchModal
        key={subBatchParentId || "sub-closed"}
        open={subBatchParentId !== ""}
        isSubcategory
        parentId={subBatchParentId}
        categories={categories}
        lockedKind={kind}
        onClose={() => setSubBatchParentId("")}
        onSave={(items) => handleCreateCategories(items, subBatchParentId)}
      />
    </Modal>
  );
}
