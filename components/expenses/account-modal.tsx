"use client";

import { useState } from "react";
import { SegmentedControl } from "./button";
import { Modal, Field, fieldInputClass, ModalFooter } from "./modal";
import { OptionGrid } from "./option-grid";
import { AmountKeypad, evaluateExpr } from "./amount-keypad";
import { AccountTypeBatchModal, type AccountTypeBatchItem } from "./account-type-batch-modal";
import { accountNameTaken, type AccountDTO } from "@/lib/expenses/accounts";
import { accountTypesByKind, type AccountKind, type AccountTypeDTO } from "@/lib/expenses/account-types";
import { categoryColorClass } from "@/lib/expenses/categories";

export interface AccountModalDraft {
  name: string;
  accountTypeId: string;
  openingBalance: number;
}

export function AccountModal({
  open,
  accounts,
  accountTypes,
  initial,
  excludeId,
  onClose,
  onSave,
  onDelete,
  onAccountTypesChange,
}: {
  open: boolean;
  /** 現有的所有帳戶，用來擋名稱重複。 */
  accounts: AccountDTO[];
  accountTypes: AccountTypeDTO[];
  initial?: AccountModalDraft;
  /** 編輯既有帳戶時傳自己的 id，重複檢查才不會把自己判定成跟自己撞名。 */
  excludeId?: string;
  onClose: () => void;
  onSave: (draft: AccountModalDraft) => void;
  onDelete?: () => void;
  /** 「＋新增」帳戶類型當場建好、或在這裡直接刪除類型後，把最新的類型清單回報給呼叫端
   *  更新自己的狀態。 */
  onAccountTypesChange: (accountTypes: AccountTypeDTO[]) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [accountTypeId, setAccountTypeId] = useState(initial?.accountTypeId ?? "");
  // 期初餘額改用彈窗下方那個固定小鍵盤輸入（跟新增交易一致），存的是算式字串。
  const [openingBalanceExpr, setOpeningBalanceExpr] = useState(initial ? String(initial.openingBalance) : "");
  const [typeBatchOpen, setTypeBatchOpen] = useState(false);
  // 類型格子改成資產／負債分頁切換，不是兩個全部攤開的格子疊在一起——類型一多，兩份
  // 都攤開會很雜。編輯既有帳戶時預設停在那個帳戶原本所屬的分頁。
  const [typeKindTab, setTypeKindTab] = useState<AccountKind>(
    () => accountTypes.find((t) => t.id === initial?.accountTypeId)?.kind ?? "asset",
  );

  const balanceNum = evaluateExpr(openingBalanceExpr);
  const isDuplicateName = accountNameTaken(accounts, name, excludeId);
  const canSave = name.trim() && accountTypeId && Number.isFinite(balanceNum) && balanceNum >= 0 && !isDuplicateName;
  const visibleTypes = accountTypesByKind(accountTypes, typeKindTab);
  const selectedKind = accountTypes.find((t) => t.id === accountTypeId)?.kind;

  function switchTypeKindTab(kind: AccountKind) {
    setTypeKindTab(kind);
    // 切分頁之後畫面上看到的格子換了一批，原本選的類型（屬於另一個分頁）不該繼續悄悄
    // 生效——逼使用者在目前這個分頁裡重新選一次，不然會變成「畫面顯示資產分頁，存檔
    // 卻存成負債帳戶」這種看不出來的落差。
    setAccountTypeId("");
  }

  // 逐筆依序 POST，理由跟其他批次新增一樣：新類型的 order 是用當下已存在筆數算出來的，
  // 併發送出會拿到同一個 order。建好之後直接選進這個帳戶，不用使用者關掉彈窗後再選一次。
  async function handleCreateTypes(items: AccountTypeBatchItem[]) {
    let latest = accountTypes;
    let firstNewId: string | undefined;
    for (const item of items) {
      const data: { accountType?: AccountTypeDTO; accountTypes?: AccountTypeDTO[] } = await fetch("/api/expenses/account-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (data.accountTypes) {
        latest = data.accountTypes;
        if (!firstNewId && data.accountType) firstNewId = data.accountType.id;
      }
    }
    onAccountTypesChange(latest);
    if (firstNewId) setAccountTypeId(firstNewId);
    setTypeBatchOpen(false);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "編輯帳戶" : "新增帳戶"}
      stickyBottom={
        <AmountKeypad
          expr={openingBalanceExpr}
          onExprChange={setOpeningBalanceExpr}
          label={selectedKind === "liability" ? "期初欠款（輸入正數）" : "期初餘額"}
        />
      }
      footer={
        <ModalFooter
          onClose={onClose}
          onConfirm={() => onSave({ name: name.trim(), accountTypeId, openingBalance: balanceNum })}
          confirmDisabled={!canSave}
          onDelete={onDelete}
        />
      }
    >
      {/* 資產／負債自己一列：它是「先決定要建哪一種帳戶」的分流，不是「類型」這個欄位的
          附屬選項，擠在欄位標籤旁邊會看起來像是類型的某種屬性。 */}
      <SegmentedControl
        className="self-start"
        value={typeKindTab}
        onChange={switchTypeKindTab}
        options={[
          { value: "asset", label: "資產" },
          { value: "liability", label: "負債" },
        ]}
      />

      <div>
        <span className="mb-2 block text-xs font-medium text-[#9C94C4]">類型</span>
        {/* 跟新增消費紀錄的分類格子完全一樣：同一個 OptionGrid、同樣的捲動高度上限，
            而且同樣只有「＋新增」沒有刪除——類型要刪一律去「設定 › 帳戶類型」，跟分類
            只能在「設定 › 收支分類」刪是同一個規則。 */}
        <div className="max-h-[260px] overflow-y-auto">
          <OptionGrid
            options={visibleTypes.map((t) => ({ id: t.id, name: t.name, icon: t.icon, colorClass: categoryColorClass[t.color] }))}
            value={accountTypeId}
            onChange={setAccountTypeId}
            onAddClick={() => setTypeBatchOpen(true)}
          />
        </div>
      </div>

      <Field label="名稱">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如「主要活存帳戶」「緊急備用金」" className={fieldInputClass} />
      </Field>
      {isDuplicateName && <p className="text-xs text-[#D1517E]">已經有同樣名稱的帳戶了，換一個名稱吧。</p>}

      <AccountTypeBatchModal
        open={typeBatchOpen}
        lockedKind={typeKindTab}
        accountTypes={accountTypes}
        onClose={() => setTypeBatchOpen(false)}
        onSave={handleCreateTypes}
      />
    </Modal>
  );
}
