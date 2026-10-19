"use client";

import { useState } from "react";
import { Button, SegmentedControl } from "./button";
import { Modal, Field, fieldInputClass } from "./modal";
import { IconAvatar } from "./icon-avatar";
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
  const [openingBalance, setOpeningBalance] = useState(initial ? String(initial.openingBalance) : "");
  const [typeBatchOpen, setTypeBatchOpen] = useState(false);
  // 類型格子改成資產／負債分頁切換，不是兩個全部攤開的格子疊在一起——類型一多，兩份
  // 都攤開會很雜。編輯既有帳戶時預設停在那個帳戶原本所屬的分頁。
  const [typeKindTab, setTypeKindTab] = useState<AccountKind>(
    () => accountTypes.find((t) => t.id === initial?.accountTypeId)?.kind ?? "asset",
  );
  const [deleteTarget, setDeleteTarget] = useState<AccountTypeDTO | null>(null);
  const [blockedInfo, setBlockedInfo] = useState<{ inUseCount: number } | null>(null);

  const balanceNum = Number(openingBalance);
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

  function TypeTile({ type }: { type: AccountTypeDTO }) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setAccountTypeId(type.id)}
          className={`flex w-full flex-col items-center gap-1.5 rounded-2xl border px-2 py-2.5 transition-colors ${
            type.id === accountTypeId ? "border-[#6F5FD6] bg-[#F3EFFC]" : "border-[#ECE4FA] bg-white"
          }`}
        >
          <IconAvatar icon={type.icon} size="sm" />
          <span className="line-clamp-1 text-xs font-medium text-[#4A3B7C]">{type.name}</span>
        </button>
        {/* 獨立的小叉叉——跟上面選取用的按鈕是兩個並排的元素，不是疊在同一顆按鈕裡
            （按鈕裡面不能再放按鈕），點這裡刪除不會連帶選到這個類型。 */}
        <button
          type="button"
          onClick={() => setDeleteTarget(type)}
          aria-label={`刪除「${type.name}」類型`}
          className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-[#ECE4FA] bg-white text-[#D1517E] shadow-sm"
        >
          <span aria-hidden className="text-[10px] leading-none">
            ✕
          </span>
        </button>
      </div>
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
        <div className="grid grid-cols-4 gap-2">
          {visibleTypes.map((t) => (
            <TypeTile key={t.id} type={t} />
          ))}
          <button
            type="button"
            onClick={() => setTypeBatchOpen(true)}
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
