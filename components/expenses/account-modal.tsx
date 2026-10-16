"use client";

import { useState } from "react";
import { Button } from "./button";
import { Modal, Field, fieldInputClass } from "./modal";
import { IconAvatar } from "./icon-avatar";
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
  /** 「＋新增」帳戶類型當場建好後，把最新的類型清單回報給呼叫端更新自己的狀態。 */
  onAccountTypesChange: (accountTypes: AccountTypeDTO[]) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [accountTypeId, setAccountTypeId] = useState(initial?.accountTypeId ?? "");
  const [openingBalance, setOpeningBalance] = useState(initial ? String(initial.openingBalance) : "");
  const [typeBatchOpen, setTypeBatchOpen] = useState(false);
  const [typeBatchKind, setTypeBatchKind] = useState<AccountKind>("asset");

  const balanceNum = Number(openingBalance);
  const isDuplicateName = accountNameTaken(accounts, name, excludeId);
  const canSave = name.trim() && accountTypeId && Number.isFinite(balanceNum) && balanceNum >= 0 && !isDuplicateName;
  const assetTypes = accountTypesByKind(accountTypes, "asset");
  const liabilityTypes = accountTypesByKind(accountTypes, "liability");
  const selectedKind = accountTypes.find((t) => t.id === accountTypeId)?.kind;

  function openTypeBatch(kind: AccountKind) {
    setTypeBatchKind(kind);
    setTypeBatchOpen(true);
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

  function TypeTile({ type }: { type: AccountTypeDTO }) {
    return (
      <button
        type="button"
        onClick={() => setAccountTypeId(type.id)}
        className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-2.5 transition-colors ${
          type.id === accountTypeId ? "border-[#6F5FD6] bg-[#F3EFFC]" : "border-[#ECE4FA] bg-white"
        }`}
      >
        <IconAvatar icon={type.icon} size="sm" />
        <span className="line-clamp-1 text-xs font-medium text-[#4A3B7C]">{type.name}</span>
      </button>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "編輯帳戶" : "新增帳戶"}
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
            <Button disabled={!canSave} onClick={() => onSave({ name: name.trim(), accountTypeId, openingBalance: balanceNum })}>
              儲存
            </Button>
          </div>
        </>
      }
    >
      <div>
        <p className="mb-2 text-xs font-medium text-[#9C94C4]">資產類型</p>
        <div className="grid grid-cols-4 gap-2">
          {assetTypes.map((t) => (
            <TypeTile key={t.id} type={t} />
          ))}
          <button
            type="button"
            onClick={() => openTypeBatch("asset")}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-[#C7BFE6] bg-white px-2 py-2.5 transition-colors hover:bg-[#F3EFFC]"
          >
            <IconAvatar icon="＋" size="sm" className="bg-[#F3EFFC] text-[#6F5FD6]" />
            <span className="line-clamp-1 text-xs font-medium text-[#6F5FD6]">新增</span>
          </button>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-[#9C94C4]">負債類型</p>
        <div className="grid grid-cols-4 gap-2">
          {liabilityTypes.map((t) => (
            <TypeTile key={t.id} type={t} />
          ))}
          <button
            type="button"
            onClick={() => openTypeBatch("liability")}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-[#C7BFE6] bg-white px-2 py-2.5 transition-colors hover:bg-[#F3EFFC]"
          >
            <IconAvatar icon="＋" size="sm" className="bg-[#F3EFFC] text-[#6F5FD6]" />
            <span className="line-clamp-1 text-xs font-medium text-[#6F5FD6]">新增</span>
          </button>
        </div>
      </div>

      <Field label="名稱">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如「主要活存帳戶」「緊急備用金」" className={fieldInputClass} />
      </Field>
      {isDuplicateName && <p className="text-xs text-[#D1517E]">已經有同樣名稱的帳戶了，換一個名稱吧。</p>}
      <Field label={selectedKind === "liability" ? "期初欠款（輸入正數）" : "期初餘額"}>
        <input type="number" min={0} value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} className={fieldInputClass} />
      </Field>

      <AccountTypeBatchModal
        open={typeBatchOpen}
        defaultKind={typeBatchKind}
        accountTypes={accountTypes}
        onClose={() => setTypeBatchOpen(false)}
        onSave={handleCreateTypes}
      />
    </Modal>
  );
}
