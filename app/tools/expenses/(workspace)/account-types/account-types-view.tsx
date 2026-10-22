"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/expenses/page-header";
import { FloatingAddButton } from "@/components/expenses/floating-add-button";
import { BackLink } from "@/components/expenses/back-link";
import { text } from "@/components/expenses/theme";
import { AccountTypeModal, type AccountTypeModalDraft } from "@/components/expenses/account-type-modal";
import { AccountTypeBatchModal, type AccountTypeBatchItem } from "@/components/expenses/account-type-batch-modal";
import { ConfirmModal } from "@/components/expenses/confirm-modal";
import { SelectionBar, SelectionDot, SelectionToggle, useSelection } from "@/components/expenses/selection-bar";
import { ListCard, ListRow } from "@/components/expenses/list-row";
import { accountTypesByKind, type AccountTypeDTO } from "@/lib/expenses/account-types";
import { categoryColorClass } from "@/lib/expenses/categories";

export function AccountTypesView() {
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<AccountTypeDTO | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [blockedInfo, setBlockedInfo] = useState<{ inUseCount: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/expenses/account-types")
      .then((res) => res.json())
      .then((data: { accountTypes?: AccountTypeDTO[] }) => {
        if (cancelled) return;
        setAccountTypes(data.accountTypes ?? []);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(draft: AccountTypeModalDraft) {
    if (!modal) return;
    const data: { accountTypes?: AccountTypeDTO[] } = await fetch("/api/expenses/account-types", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: modal.id, ...draft }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.accountTypes) setAccountTypes(data.accountTypes);
    setModal(null);
  }

  // 刪除類型沒有「未分類」這種通用歸宿可以自動改掛（見 account-types.server.ts 的
  // 說明），所以這裡不是問「要不要強制刪除」，查到還有帳戶在用就直接擋下、告知筆數，
  // 使用者要先把那些帳戶改到別的類型才能刪除。
  async function tryDeleteTypes(ids: string[]) {
    let latest = accountTypes;
    let totalInUse = 0;
    let blockedCount = 0;
    for (const id of ids) {
      const res = await fetch(`/api/expenses/account-types?id=${id}`, { method: "DELETE" }).catch(() => null);
      if (!res) continue;
      const data: { accountTypes?: AccountTypeDTO[]; inUseCount?: number } = await res.json().catch(() => ({}));
      if (res.status === 409) {
        blockedCount++;
        totalInUse += data.inUseCount ?? 0;
      } else if (data.accountTypes) {
        latest = data.accountTypes;
      }
    }
    setAccountTypes(latest);
    return { blockedCount, totalInUse };
  }

  async function handleDelete() {
    if (!modal) return;
    const { blockedCount, totalInUse } = await tryDeleteTypes([modal.id]);
    setModal(null);
    if (blockedCount > 0) setBlockedInfo({ inUseCount: totalInUse });
  }

  async function handleBulkDelete() {
    const { blockedCount, totalInUse } = await tryDeleteTypes([...selection.selectedIds]);
    selection.exit();
    if (blockedCount > 0) setBlockedInfo({ inUseCount: totalInUse });
  }

  // 批次新增：逐筆依序 POST（不是 Promise.all 併發），理由跟分類批次新增一樣——
  // createAccountType 的 order 是用當下已存在筆數算出來的，併發送出會拿到同一個 order。
  async function handleBatchSave(items: AccountTypeBatchItem[]) {
    let latest = accountTypes;
    for (const item of items) {
      const data: { accountTypes?: AccountTypeDTO[] } = await fetch("/api/expenses/account-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (data.accountTypes) latest = data.accountTypes;
    }
    setAccountTypes(latest);
    setBatchOpen(false);
  }

  const assetTypes = accountTypesByKind(accountTypes, "asset");
  const liabilityTypes = accountTypesByKind(accountTypes, "liability");
  const selection = useSelection(accountTypes.map((t) => t.id));

  return (
    <div>
      {/* 標題列只留「選取」跟返回箭頭——新增搬到右下角的浮動按鈕（跟首頁新增交易同一招），
          按鈕一多擠一列在手機上會換行成兩排，很難看也很難點。常見類型現在是第一次進
          記帳本時就自動建好的（見 lib/expenses/presets.server.ts），不再需要套用按鈕。 */}
      <PageHeader
        title="帳戶類型"
        actions={
          <div className="flex items-center gap-2">
            <SelectionToggle selecting={selection.selecting} onToggle={selection.toggleMode} />
            <BackLink href="/tools/expenses/assets" label="返回資產總表" />
          </div>
        }
      />

      <FloatingAddButton onClick={() => setBatchOpen(true)} label="新增帳戶類型" />

      <AccountTypeModal
        key={modal ? modal.id : "closed"}
        open={modal !== null}
        initial={modal ?? undefined}
        accountTypes={accountTypes}
        kind={modal?.kind ?? "asset"}
        excludeId={modal?.id}
        onClose={() => setModal(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
      <AccountTypeBatchModal open={batchOpen} onClose={() => setBatchOpen(false)} onSave={handleBatchSave} accountTypes={accountTypes} />

      <ConfirmModal
        open={blockedInfo !== null}
        title="這個類型還有帳戶在用"
        message={`還有 ${blockedInfo?.inUseCount ?? 0} 個帳戶掛著選取的類型，無法刪除。請先把這些帳戶改成別的類型，再回來刪除。`}
        onlyAcknowledge
        onClose={() => setBlockedInfo(null)}
      />

      {selection.selecting && (
        <SelectionBar
          count={selection.selectedIds.size}
          total={selection.total}
          onToggleAll={selection.toggleAll}
          onCancel={selection.exit}
          onDelete={handleBulkDelete}
        />
      )}

      {!ready ? (
        <p className={text.faint}>載入中…</p>
      ) : accountTypes.length === 0 ? (
        <p className={text.faint}>還沒有任何帳戶類型，點右下角的＋新增</p>
      ) : (
        <div className="flex flex-col gap-5">
          {assetTypes.length > 0 && (
            <div>
              <p className={`mb-2 px-1 ${text.sectionHeading}`}>資產</p>
              <ListCard>
                {assetTypes.map((t) => (
                  <ListRow
                    key={t.id}
                    icon={t.icon}
                    iconClassName={categoryColorClass[t.color]}
                    name={t.name}
                    leading={selection.selecting ? <SelectionDot selected={selection.selectedIds.has(t.id)} /> : undefined}
                    onClick={() => (selection.selecting ? selection.toggle(t.id) : setModal(t))}
                  />
                ))}
              </ListCard>
            </div>
          )}

          {liabilityTypes.length > 0 && (
            <div>
              <p className={`mb-2 px-1 ${text.sectionHeading}`}>負債</p>
              <ListCard>
                {liabilityTypes.map((t) => (
                  <ListRow
                    key={t.id}
                    icon={t.icon}
                    iconClassName={categoryColorClass[t.color]}
                    name={t.name}
                    leading={selection.selecting ? <SelectionDot selected={selection.selectedIds.has(t.id)} /> : undefined}
                    onClick={() => (selection.selecting ? selection.toggle(t.id) : setModal(t))}
                  />
                ))}
              </ListCard>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
