"use client";

import { useState } from "react";
import { OptionChip, SegmentedControl } from "./button";
import { Modal, Field, RequiredMark, fieldInputClass, ModalFooter } from "./modal";
import { DateField } from "./date-field";
import { CategoryGridPicker } from "./category-grid-picker";
import { AmountField, AmountKeypad, evaluateExpr } from "./amount-keypad";
import { AccountPickerModal } from "./account-picker-modal";
import { SelectField } from "./select-field";
import { CategoryBatchModal, type CategoryBatchItem } from "./category-batch-modal";
import { text } from "./theme";
import { categoryPath, needsSubcategory, type CategoryDTO, type CategoryKind } from "@/lib/expenses/categories";
import { occurrencesUpTo, type RecurrenceFrequencyUnit, type RecurringTransfer } from "@/lib/expenses/recurring-rules";
import type { AccountDTO } from "@/lib/expenses/accounts";
import type { AccountTypeDTO } from "@/lib/expenses/account-types";
import type { SavingsGoalDTO } from "@/lib/expenses/goals";
import { InlineIcon } from "./icon-avatar";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 這條規則記的是收支還是轉帳。轉帳不是支出也不是收入（錢只是從一個戶頭搬到另一個），
 *  所以它沒有分類，換成「從哪個帳戶、到哪個帳戶、手續費多少」。 */
export type RecurringRuleKind = CategoryKind | "轉帳";

export interface RecurringRuleModalDraft {
  categoryId: string;
  /** 有值＝轉帳規則。 */
  transfer?: RecurringTransfer;
  amount: number;
  note?: string;
  frequencyUnit: RecurrenceFrequencyUnit;
  interval: number;
  startDate: string;
  cycleCount?: number;
  linkedGoalId?: string;
}

const FREQUENCY_OPTIONS: { value: RecurrenceFrequencyUnit; label: string }[] = [
  { value: "day", label: "每天" },
  { value: "week", label: "每週" },
  { value: "month", label: "每月" },
];

/** 新增／編輯固定收支規則——跟 TransactionModal 共用「收支類型→分類」的篩選邏輯
 *  （同一個 CategoryGridPicker、同一個分類清單），差別只在於這裡多了頻率／循環次數／
 *  開始日期這組「排程」欄位。 */
export function RecurringRuleModal({
  open,
  categories,
  accounts,
  accountTypes,
  goals,
  defaultKind,
  initial,
  confirmedDates,
  onClose,
  onSave,
  onDelete,
  onCategoriesChange,
}: {
  open: boolean;
  categories: CategoryDTO[];
  /** 轉帳類型要選「從哪個帳戶、到哪個帳戶」。 */
  accounts: AccountDTO[];
  accountTypes: AccountTypeDTO[];
  /** 只有分類是「收入」時才會顯示「同時存入目標」選項，所以需要目標清單。 */
  goals: SavingsGoalDTO[];
  defaultKind: RecurringRuleKind;
  initial?: RecurringRuleModalDraft;
  onClose: () => void;
  onSave: (draft: RecurringRuleModalDraft) => void;
  onDelete?: () => void;
  /** 這條規則已經入帳過的那幾期是哪幾天（編輯既有規則時才需要傳）。
   *
   *  待確認是拿「排程算出來的日期」去比對「已入帳的日期」，所以改了頻率／間隔／開始日
   *  之後，原本已入帳的那幾筆有可能就對不上新的排程了——交易本身會留著（它們是獨立
   *  快照，刻意不受規則變動影響），但「已入帳 N / M 期」的 N 會突然變小，而且那幾筆
   *  從這一頁完全看不出來。所以改之前先講清楚會有幾筆對不上。 */
  confirmedDates?: string[];
  /** 分類格子裡「＋新增」當場建好新分類後，把最新的分類清單回報給呼叫端更新自己的
   *  categories 狀態。 */
  onCategoriesChange: (categories: CategoryDTO[]) => void;
}) {
  const initialCategory = initial ? categories.find((c) => c.id === initial.categoryId) : undefined;
  const [kind, setKind] = useState<RecurringRuleKind>(initial?.transfer ? "轉帳" : (initialCategory?.kind ?? defaultKind));
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [fromAccountId, setFromAccountId] = useState(initial?.transfer?.fromAccountId ?? "");
  const [toAccountId, setToAccountId] = useState(initial?.transfer?.toAccountId ?? "");
  const [fee, setFee] = useState(initial?.transfer?.fee ? String(initial.transfer.fee) : "");
  // 轉帳類型有兩個金額欄位（每次金額、手續費），下方那個固定小鍵盤跟著點到的那一欄走
  // ——跟新增轉帳彈窗同一套做法。收支類型只有一個金額，永遠是 amount。
  const [amountTarget, setAmountTarget] = useState<"amount" | "fee">("amount");
  const [picking, setPicking] = useState<"from" | "to" | null>(null);
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [frequencyUnit, setFrequencyUnit] = useState<RecurrenceFrequencyUnit>(initial?.frequencyUnit ?? "month");
  const [interval, setInterval_] = useState(initial ? String(initial.interval) : "1");
  const [startDate, setStartDate] = useState(initial?.startDate ?? todayISO());
  const [cycleCount, setCycleCount] = useState(initial?.cycleCount ? String(initial.cycleCount) : "");
  const [linkedGoalId, setLinkedGoalId] = useState(initial?.linkedGoalId ?? "");
  const [categoryBatchOpen, setCategoryBatchOpen] = useState(false);


  const amountNum = evaluateExpr(amount);
  const feeNum = evaluateExpr(fee);
  const isTransfer = kind === "轉帳";
  const intervalNum = Number(interval);
  const cycleCountNum = cycleCount.trim() ? Number(cycleCount) : undefined;

  /** 照目前表單上的排程重算一次，已入帳的那幾天有幾天對不上。
   *
   *  只在「排程真的被改過」時才算：規則本來就有對不上的幾筆時，一打開彈窗就跳警告反而
   *  像是這次編輯造成的。untilDate 用最後一筆已入帳的日期——比那還晚的期數不可能已經
   *  入帳過，不用算進來。 */
  const orphanCount = (() => {
    if (!initial || !confirmedDates || confirmedDates.length === 0) return 0;
    const scheduleChanged =
      frequencyUnit !== initial.frequencyUnit || Math.floor(intervalNum) !== initial.interval || startDate !== initial.startDate;
    if (!scheduleChanged) return 0;
    if (!startDate || !Number.isFinite(intervalNum) || intervalNum < 1) return 0;
    const latest = confirmedDates.reduce((a, b) => (a > b ? a : b));
    const scheduled = new Set(
      occurrencesUpTo({ startDate, frequencyUnit, interval: Math.floor(intervalNum), cycleCount: cycleCountNum }, latest).map((o) => o.date),
    );
    return confirmedDates.filter((d) => !scheduled.has(d)).length;
  })();
  const canSave =
    (isTransfer
      ? // 轉給自己等於什麼都沒發生，每期還會生出一筆看不懂的紀錄，所以兩個帳戶不能相同。
        !!fromAccountId && !!toAccountId && fromAccountId !== toAccountId
      : // 跟新增交易同一條規則：有子分類的大分類要挑到底下的項目（見 needsSubcategory）。
        !!categoryId && !needsSubcategory(categories, categoryId)) &&
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    Number.isFinite(intervalNum) &&
    intervalNum >= 1 &&
    startDate &&
    (cycleCountNum === undefined || (Number.isFinite(cycleCountNum) && cycleCountNum > 0));

  // 逐筆依序 POST，理由跟新增交易彈窗的「＋新增」分類一樣：新分類的 order 是用當下已
  // 存在筆數算出來的，併發送出會拿到同一個 order。建好之後直接選進這條規則。
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
      title={initial ? "編輯固定收支" : "新增固定收支"}
      fullHeight
      stickyBottom={
        <AmountKeypad
          expr={isTransfer && amountTarget === "fee" ? fee : amount}
          onExprChange={isTransfer && amountTarget === "fee" ? setFee : setAmount}
          label={isTransfer && amountTarget === "fee" ? "手續費" : "每次金額"}
          // 手續費留空就是沒有手續費，是合理答案。
          required={!(isTransfer && amountTarget === "fee")}
        />
      }
      footer={
        <ModalFooter
          onClose={onClose}
          onConfirm={() =>
            onSave({
              // 兩種類型互斥：轉帳沒有分類，收支沒有 transfer。
              categoryId: isTransfer ? "" : categoryId,
              transfer: isTransfer
                ? { fromAccountId, toAccountId, fee: Number.isFinite(feeNum) && feeNum > 0 ? feeNum : undefined }
                : undefined,
              amount: amountNum,
              note: note.trim() || undefined,
              frequencyUnit,
              interval: Math.floor(intervalNum),
              startDate,
              cycleCount: cycleCountNum,
              linkedGoalId: kind === "收入" && linkedGoalId ? linkedGoalId : undefined,
            })
          }
          confirmDisabled={!canSave}
          onDelete={onDelete}
          // 呼叫端自己有一套講得更清楚的確認（會說明底下的子項目／紀錄會怎麼樣），
          // 不要再疊一層空泛的「確定要刪除嗎」。
          deleteConfirm={false}
        />
      }
    >
      {/* 多了「轉帳」這一格：每個月固定從薪轉戶轉一筆去儲蓄帳戶、固定還房貸，這些都是
          排程性的轉帳，本來只能硬記成支出，記了之後那筆錢會被算進每個月的支出統計裡。 */}
      <SegmentedControl
        className="self-start"
        value={kind}
        onChange={(k) => {
          setKind(k);
          // 換類型就把另一種類型的選擇清掉，不要留著上一個類型挑到一半的分類／帳戶。
          setCategoryId("");
          setAmountTarget("amount");
        }}
        options={[
          { value: "支出", label: "支出" },
          { value: "收入", label: "收入" },
          { value: "轉帳", label: "轉帳" },
        ]}
      />

      {isTransfer ? (
        <>
          {/* 轉出／轉入並排，跟新增轉帳彈窗一樣：這兩欄是一組「從哪裡到哪裡」，上下排
              要掃兩次才看得出方向。 */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="從（轉出帳戶）" required>
              <SelectField
                value={accounts.find((a) => a.id === fromAccountId)?.name}
                placeholder="選擇帳戶"
                onClick={() => setPicking("from")}
              />
            </Field>
            <Field label="到（轉入帳戶）" required>
              <SelectField value={accounts.find((a) => a.id === toAccountId)?.name} placeholder="選擇帳戶" onClick={() => setPicking("to")} />
            </Field>
          </div>

          <AmountField
            label="每次金額"
            required
            value={amountNum}
            active={amountTarget === "amount"}
            onFocus={() => setAmountTarget("amount")}
            placeholder=""
          />
          <AmountField label="手續費" value={feeNum} active={amountTarget === "fee"} onFocus={() => setAmountTarget("fee")} placeholder="沒有就留空" />
          <p className={`-mt-1 ${text.faint}`}>
            每一期入帳時會記成一筆轉帳，不算進支出或收入統計。有填手續費的話會另外記一筆掛在「手續費」分類的支出，從轉出帳戶扣——那是真的花掉的錢。
          </p>
        </>
      ) : (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-[#9C94C4]">
              分類
              <RequiredMark />
            </span>
            {categoryId && <span className="text-xs font-medium text-[#4A3B7C]">{categoryPath(categories, categoryId)}</span>}
          </div>
          <CategoryGridPicker
            categories={categories}
            kind={kind}
            value={categoryId}
            onChange={setCategoryId}
            onAddClick={() => setCategoryBatchOpen(true)}
            maxHeightClass="max-h-[200px]"
          />
        </div>
      )}


      <Field label="頻率">
        <SegmentedControl className="self-start" value={frequencyUnit} onChange={setFrequencyUnit} options={FREQUENCY_OPTIONS} />
      </Field>
      {/* 間隔跟循環次數兩欄一列：兩個都是「這條規則要重複幾次、隔多久」的數字，並排
          才看得出是一組；各佔一整列會把彈窗拉長到要捲動。標籤縮短成兩個字，不然兩欄
          各自會擠成兩行——詳細說明收到底下那行小字。 */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="間隔" required>
          <input type="number" min={1} value={interval} onChange={(e) => setInterval_(e.target.value)} className={fieldInputClass} />
        </Field>
        <Field label="循環次數">
          <input type="number" min={1} value={cycleCount} onChange={(e) => setCycleCount(e.target.value)} className={fieldInputClass} />
        </Field>
      </div>
      <p className={`-mt-1 ${text.faint}`}>間隔是「每隔幾個單位來一次」（每 2 週就填 2）。循環次數留空＝無限期循環，房租這種沒有結束日的就不用填。</p>

      <Field label="開始日期" required>
        <DateField value={startDate} onChange={setStartDate} />
      </Field>
      {orphanCount > 0 && (
        <p className="rounded-2xl bg-[#FDEEF0] px-4 py-3 text-xs leading-relaxed text-[#D1517E]">
          改了排程之後，已經入帳的 {confirmedDates?.length} 筆裡有 {orphanCount} 筆會對不上新的期數。
          那些紀錄會留著不會被刪，但「已入帳 ◯ / ◯ 期」的數字會跟著變小，對不上的那幾期也會重新出現在待確認裡。
        </p>
      )}

      <Field label="備註">
        <input value={note} onChange={(e) => setNote(e.target.value)} className={fieldInputClass} />
      </Field>

      {kind === "收入" && goals.length > 0 && (
        <Field label="同時存入目標——「週期存錢」就是在這裡選一個目標">
          {/* 這幾顆本來是手刻的，跟「項目」那一排長一樣卻各寫一份；換成共用的 OptionChip。
              目標的 icon 存的是圖片路徑（例如 /expenses/expenses-category-travel.png），
              本來直接 `{g.icon} {g.name}` 印出來，畫面上就是一整串路徑文字接著名稱。
              改用 InlineIcon：是路徑就畫成圖，是 emoji 就原樣輸出。 */}
          <div className="flex flex-wrap gap-2">
            <OptionChip active={!linkedGoalId} onClick={() => setLinkedGoalId("")}>
              不連動目標
            </OptionChip>
            {goals.map((g) => (
              <OptionChip key={g.id} active={linkedGoalId === g.id} onClick={() => setLinkedGoalId(g.id)}>
                <InlineIcon icon={g.icon} />
                {g.name}
              </OptionChip>
            ))}
          </div>
        </Field>
      )}

      {/* 不顯示餘額：這裡設定的是一條往後每個月都會跑的規則，當下餘額跟「要從哪個戶頭
          固定轉出」這個決定沒有關係。選到跟對面同一個帳戶時直接對調，那正好是使用者
          想做的事（方向填反了）。 */}
      <AccountPickerModal
        open={picking !== null}
        title={picking === "to" ? "選擇轉入帳戶" : "選擇轉出帳戶"}
        accounts={accounts}
        accountTypes={accountTypes}
        showBalance={false}
        allowUnset={false}
        value={(picking === "to" ? toAccountId : fromAccountId) || undefined}
        onClose={() => setPicking(null)}
        onSelect={(id) => {
          const picked = id ?? "";
          if (picking === "to") {
            if (picked && picked === fromAccountId) setFromAccountId(toAccountId);
            setToAccountId(picked);
          } else {
            if (picked && picked === toAccountId) setToAccountId(fromAccountId);
            setFromAccountId(picked);
          }
          setPicking(null);
        }}
      />

      <CategoryBatchModal
        open={categoryBatchOpen}
        isSubcategory={false}
        categories={categories}
        lockedKind={isTransfer ? "支出" : kind}
        onClose={() => setCategoryBatchOpen(false)}
        onSave={handleCreateCategories}
      />
    </Modal>
  );
}
