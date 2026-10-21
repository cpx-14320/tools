"use client";

import { useState } from "react";
import { SegmentedControl } from "./button";
import { Modal, Field, fieldInputClass, ModalFooter } from "./modal";
import { OptionGrid } from "./option-grid";
import { AmountKeypad, evaluateExpr } from "./amount-keypad";
import { ConfirmModal } from "./confirm-modal";
import { AccountTypeBatchModal, type AccountTypeBatchItem } from "./account-type-batch-modal";
import { accountNameTaken, type AccountDTO } from "@/lib/expenses/accounts";
import { accountTypesByKind, type AccountKind, type AccountTypeDTO } from "@/lib/expenses/account-types";

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
  const [deleteTarget, setDeleteTarget] = useState<AccountTypeDTO | null>(null);
  const [blockedInfo, setBlockedInfo] = useState<{ inUseCount: number } | null>(null);

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

  // 刪除類型沒有「未分類」這種通用歸宿（見 account-types.server.ts 的說明），還有帳戶
  // 在用的話會被擋下，彈出 blockedInfo 告知筆數，使用者要先把那些帳戶改到別的類型。
  async function handleDeleteType() {
    if (!deleteTarget) return;
    const res = await fetch(`/api/expenses/account-types?id=${deleteTarget.id}`, { method: "DELETE" }).catch(() => null);
    if (res?.status === 409) {
      const data: { inUseCount?: number } = await res.json().catch(() => ({}));
      setBlockedInfo({ inUseCount: data.inUseCount ?? 0 });
      return;
    }
    const data: { accountTypes?: AccountTypeDTO[] } = (await res?.json().catch(() => ({}))) ?? {};
    if (data.accountTypes) {
      onAccountTypesChange(data.accountTypes);
      // 剛好刪到目前選著的那個類型，選取狀態要跟著清掉，不然會留著一個已經不存在的 id。
      if (accountTypeId === deleteTarget.id) setAccountTypeId("");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "編輯帳戶" : "新增帳戶"}
      fullHeight
      stickyBottom={
        <AmountKeypad
          expr={openingBalanceExpr}
          onExprChange={setOpeningBalanceExpr}
          color="#6F5FD6"
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
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-[#9C94C4]">類型</span>
          <SegmentedControl
            value={typeKindTab}
            onChange={switchTypeKindTab}
            options={[
              { value: "asset", label: "資產" },
              { value: "liability", label: "負債" },
            ]}
          />
        </div>
        {/* 跟新增消費紀錄的分類格子同一個元件（OptionGrid）——欄數、選取樣式、
            「＋新增」的位置都一致，不再兩邊各長一個樣。 */}
        <OptionGrid
          options={visibleTypes.map((t) => ({ id: t.id, name: t.name, icon: t.icon }))}
          value={accountTypeId}
          onChange={setAccountTypeId}
          onAddClick={() => setTypeBatchOpen(true)}
          onDelete={(option) => setDeleteTarget(accountTypes.find((t) => t.id === option.id) ?? null)}
          deleteLabelOf={(option) => `刪除「${option.name}」類型`}
        />
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

      <ConfirmModal
        open={deleteTarget !== null}
        title="刪除帳戶類型"
        message={`確定要刪除「${deleteTarget?.name ?? ""}」這個類型嗎？`}
        onConfirm={handleDeleteType}
        onClose={() => setDeleteTarget(null)}
      />
      <ConfirmModal
        open={blockedInfo !== null}
        title="這個類型還有帳戶在用"
        message={`還有 ${blockedInfo?.inUseCount ?? 0} 個帳戶掛著這個類型，無法刪除。請先把這些帳戶改成別的類型，再回來刪除。`}
        onlyAcknowledge
        onClose={() => setBlockedInfo(null)}
      />
    </Modal>
  );
}
