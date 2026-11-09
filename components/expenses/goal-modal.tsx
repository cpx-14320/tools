"use client";

import { useState } from "react";
import { Modal, Field, fieldInputClass, ModalFooter } from "./modal";
import { DateField } from "./date-field";
import { AmountField, AmountKeypad, evaluateExpr } from "./amount-keypad";
import { AccountPickerModal } from "./account-picker-modal";
import { GoalIconPicker, DEFAULT_PICKER_ICON } from "./category-field-pickers";
import { SegmentedControl } from "./button";
import { PickerIcon } from "./icon-avatar";
import { text } from "./theme";
import type { AccountDTO } from "@/lib/expenses/accounts";
import { accountTypeById, type AccountTypeDTO } from "@/lib/expenses/account-types";

export interface GoalModalDraft {
  name: string;
  icon: string;
  targetAmount: number;
  currentAmount: number;
  /** null＝手動記錄（解除綁定），字串＝綁定那個帳戶。 */
  accountId: string | null;
  startDate?: string;
  targetDate?: string;
}

/** 新增／編輯存錢目標。
 *
 *  **進度有兩種來源，由使用者選**（舊版只有手動記錄）：
 *
 *  - 自行記錄：自己填「目前已存多少」。想存多少、放在哪個戶頭都不管，彈性最大，代價是
 *    要記得回來更新，久了很容易跟實際存款對不起來。
 *  - 綁定帳戶：進度直接看那個帳戶的餘額。錢本來就放在某個戶頭裡，這樣永遠不會對不起來，
 *    也不用每次存錢都回來點一次；代價是一個帳戶配一個目標才準（兩個目標綁同一個帳戶，
 *    兩邊的進度會是同一個數字）。
 *
 *  **「存入」併進這裡了**，不再有獨立的存入彈窗：存入講的是「總額變成多少」的一種算法，
 *  跟「目前已存」本來就是同一個欄位。獨立彈窗的代價是列表上要多一顆按鈕，而且使用者點進
 *  編輯彈窗時看不到、也改不了自己存了多少。金額鍵盤吃算式，所以要「再存 3000」直接打
 *  12000+3000 就好。 */
export function GoalModal({
  open,
  initial,
  accounts,
  accountTypes,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  /** 沒有 initial 代表新增。 */
  initial?: GoalModalDraft;
  accounts: AccountDTO[];
  accountTypes: AccountTypeDTO[];
  onClose: () => void;
  onSave: (draft: GoalModalDraft) => void;
  onDelete?: () => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? DEFAULT_PICKER_ICON);
  // 兩個金額都用彈窗下方那個固定小鍵盤輸入，target 記錄現在在編哪一個——跟新增交易
  // 彈窗編明細金額是同一套做法，不要讓其中一個欄位跳原生數字鍵盤。
  const [targetAmount, setTargetAmount] = useState(initial ? String(initial.targetAmount) : "");
  const [currentAmount, setCurrentAmount] = useState(initial ? String(initial.currentAmount) : "0");
  const [target, setTarget] = useState<"target" | "current">("target");
  const [accountId, setAccountId] = useState<string | null>(initial?.accountId ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? "");

  const bound = accountId !== null;
  const account = accounts.find((a) => a.id === accountId);
  const targetAmountNum = evaluateExpr(targetAmount);
  const currentAmountNum = evaluateExpr(currentAmount);
  const canSave =
    !!name.trim() &&
    !!icon.trim() &&
    Number.isFinite(targetAmountNum) &&
    targetAmountNum > 0 &&
    // 綁定模式不看「目前已存」（那個欄位整個不顯示），但一定要真的綁到一個存在的帳戶。
    (bound ? !!account : Number.isFinite(currentAmountNum) && currentAmountNum >= 0);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        // 標題帶上目標名稱，跟編輯預算（「編輯預算 社交」）同一個寫法——從列表點進來時
        // 一眼確認自己開到的是哪一個目標。
        title={isEdit ? `編輯目標 ${initial.name}` : "新增存錢目標"}
        fullHeight
        stickyBottom={
          // 綁定模式只剩「目標金額」一個金額欄位，鍵盤就固定編它。
          <AmountKeypad
            expr={bound || target === "target" ? targetAmount : currentAmount}
            onExprChange={bound || target === "target" ? setTargetAmount : setCurrentAmount}
            label={bound || target === "target" ? "目標金額" : "目前已經存了多少"}
            // 目標金額要大於 0 才存得了；「目前已經存了多少」留空就是 0，是合理答案。
            required={bound || target === "target"}
          />
        }
        footer={
          <ModalFooter
            onClose={onClose}
            onConfirm={() =>
              onSave({
                name: name.trim(),
                icon: icon.trim(),
                targetAmount: targetAmountNum,
                currentAmount: currentAmountNum,
                accountId,
                startDate: startDate || undefined,
                targetDate: targetDate || undefined,
              })
            }
            confirmDisabled={!canSave}
            onDelete={onDelete}
            // 呼叫端自己有一套講得更清楚的確認（會說明連動的固定收支會解除），不要再疊
            // 一層空泛的「確定要刪除嗎」。
            deleteConfirm={false}
          />
        }
      >
        <Field label="名稱" required>
          <input value={name} onChange={(e) => setName(e.target.value)} className={fieldInputClass} />
        </Field>
        <GoalIconPicker value={icon} onChange={setIcon} required />
        {/* placeholder 留空：欄位本來就標著「目標金額」，再寫一次「點這裡用下方鍵盤輸入」
            只是把同一件事說兩遍。 */}
        <AmountField
          label="目標金額"
          required
          value={targetAmountNum}
          active={bound || target === "target"}
          onFocus={() => setTarget("target")}
          placeholder=""
        />

        <Field label="進度如何計算" required>
          <SegmentedControl
            value={bound ? "account" : "manual"}
            onChange={(v) => {
              if (v === "manual") setAccountId(null);
              // 切到綁定模式時直接把挑帳戶的彈窗開起來：這個模式沒有選到帳戶就不完整，
              // 讓使用者自己再去找一顆「選擇帳戶」按鈕只是多一步。
              else setPickerOpen(true);
            }}
            options={[
              { value: "manual", label: "自行記錄" },
              { value: "account", label: "綁定帳戶" },
            ]}
          />
        </Field>

        {bound ? (
          <>
            <Field label="綁定的帳戶" required>
              <button type="button" onClick={() => setPickerOpen(true)} className={`${fieldInputClass} flex items-center gap-2 text-left`}>
                {account ? (
                  <>
                    <PickerIcon icon={accountTypeById(accountTypes, account.accountTypeId)?.icon ?? ""} />
                    <span>{account.name}</span>
                  </>
                ) : (
                  <span className={text.faint}>選一個帳戶</span>
                )}
              </button>
            </Field>
            <p className={`-mt-1 ${text.faint}`}>
              進度會直接看這個帳戶的餘額，存錢之後不用再回來更新。同一個帳戶綁兩個目標的話，兩邊的進度會是同一個數字。
            </p>
          </>
        ) : (
          <>
            <AmountField
              label="目前已經存了多少"
              value={currentAmountNum}
              active={target === "current"}
              onFocus={() => setTarget("current")}
              // 0 元的時候要看得到「NT$ 0」。AmountField 對 0 是當成「沒有值」顯示
              // placeholder，留空的話這一欄會變成一個空框，看起來像壞掉。
              placeholder="NT$ 0"
            />
            <p className={`-mt-1 ${text.faint}`}>
              又存了一筆就把這個數字改成新的總額。下面的鍵盤吃算式，所以直接打「現在的金額＋這次存的」也可以。
            </p>
          </>
        )}

        {/* 起訖兩欄一列：它們是同一件事的兩端，並排才看得出是一段期間；上下排的話中間還隔
            著一行標籤，像兩個不相干的欄位。標籤也跟著縮短，不然兩欄會各自擠成兩行
            ——「可不填」三個字統一收到下面那行說明。 */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="開始日期">
            <DateField value={startDate} onChange={setStartDate} placeholder="不設定" />
          </Field>
          <Field label="目標日期">
            <DateField value={targetDate} onChange={setTargetDate} placeholder="不設期限" />
          </Field>
        </div>
        <p className={`-mt-1 ${text.faint}`}>兩個都可以不填。開始日期純顯示用，目標日期會用來算「平均每週要存多少」。</p>
      </Modal>

      {/* 挑帳戶：不顯示餘額——這裡問的是「錢放在哪個戶頭」，選完之後整個進度條就是那個
          餘額，在選單裡再列一次只是把同一個數字講兩遍。沒選就關掉時退回手動記錄模式，
          不要卡在「綁定帳戶但沒有帳戶」這種半成品狀態。 */}
      <AccountPickerModal
        open={pickerOpen}
        title="綁定帳戶"
        accounts={accounts}
        accountTypes={accountTypes}
        showBalance={false}
        unsetLabel="改成自行記錄"
        onClose={() => {
          setPickerOpen(false);
          // 用函式型更新讀**當下**的值，不是這個 closure 裡的 accountId：選擇彈窗按下
          // 某個帳戶時會先 onSelect 再 onClose，拿 closure 裡的舊值（還是 null）去判斷
          // 的話，剛選好的帳戶會立刻被這一行清掉，畫面彈回「自己記」。
          setAccountId((current) => (current && accounts.some((a) => a.id === current) ? current : null));
        }}
        onSelect={(picked) => {
          setPickerOpen(false);
          setAccountId(picked || null);
        }}
      />
    </>
  );
}
