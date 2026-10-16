"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/expenses/page-header";
import { Button, ButtonLink } from "@/components/expenses/button";
import { text } from "@/components/expenses/theme";
import { AccountTypeModal, type AccountTypeModalDraft } from "@/components/expenses/account-type-modal";
import { AccountTypeBatchModal, type AccountTypeBatchItem } from "@/components/expenses/account-type-batch-modal";
import { ConfirmModal } from "@/components/expenses/confirm-modal";
import { SelectionBar, SelectionDot } from "@/components/expenses/selection-bar";
import { accountTypesByKind, DEFAULT_ACCOUNT_TYPES, type AccountTypeDTO } from "@/lib/expenses/account-types";

export function AccountTypesView() {
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<AccountTypeDTO | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [blockedInfo, setBlockedInfo] = useState<{ inUseCount: number } | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
    const { blockedCount, totalInUse } = await tryDeleteTypes([...selectedIds]);
    setSelecting(false);
    setSelectedIds(new Set());
    if (blockedCount > 0) setBlockedInfo({ inUseCount: totalInUse });
  }

  function toggleSelected(id: string) {
    setSelectedIds((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  // 套用常見類型：跳過名稱（同資產/負債下）已經存在的項目，可以重複點，缺哪個補哪個。
  async function handleApplyDefaults() {
    const existingNames = new Set(accountTypes.map((t) => `${t.kind}:${t.name}`));
    const toCreate = DEFAULT_ACCOUNT_TYPES.filter((d) => !existingNames.has(`${d.kind}:${d.name}`));
    if (toCreate.length === 0) return;
    let latest = accountTypes;
    for (const item of toCreate) {
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
  }

  const assetTypes = accountTypesByKind(accountTypes, "asset");
  const liabilityTypes = accountTypesByKind(accountTypes, "liability");

  return (
    <div>
      <PageHeader
        title="帳戶類型"
        actions={
          <div className="flex items-center gap-2">
            <ButtonLink href="/tools/expenses/assets" variant="secondary">
              ‹ 回資產總表
            </ButtonLink>
            <Button variant="secondary" onClick={handleApplyDefaults}>
              套用常見類型
            </Button>
            <Button variant="secondary" onClick={() => setSelecting((v) => !v)}>
              {selecting ? "完成" : "選取"}
            </Button>
            <Button onClick={() => setBatchOpen(true)}>＋ 新增類型</Button>
          </div>
        }
      />

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

      {selecting && (
        <SelectionBar
          count={selectedIds.size}
          total={accountTypes.length}
          onToggleAll={() =>
            setSelectedIds((set) => (set.size === accountTypes.length ? new Set() : new Set(accountTypes.map((t) => t.id))))
          }
          onCancel={() => {
            setSelecting(false);
            setSelectedIds(new Set());
          }}
          onDelete={handleBulkDelete}
        />
      )}

      {!ready ? (
        <p className={text.faint}>載入中…</p>
      ) : accountTypes.length === 0 ? (
        <p className={text.faint}>還沒有任何帳戶類型，點上方新增或套用常見類型</p>
      ) : (
        <div className="flex flex-col gap-5">
          {assetTypes.length > 0 && (
            <div>
              <p className={`mb-2 px-1 ${text.sectionHeading}`}>資產</p>
              <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#ECE4FA] bg-white">
                {assetTypes.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => (selecting ? toggleSelected(t.id) : setModal(t))}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                  >
                    {selecting && <SelectionDot selected={selectedIds.has(t.id)} />}
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#F3EFFC] text-lg">{t.icon}</span>
                    <span className={`min-w-0 flex-1 ${text.body}`}>{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {liabilityTypes.length > 0 && (
            <div>
              <p className={`mb-2 px-1 ${text.sectionHeading}`}>負債</p>
              <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#ECE4FA] bg-white">
                {liabilityTypes.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => (selecting ? toggleSelected(t.id) : setModal(t))}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                  >
                    {selecting && <SelectionDot selected={selectedIds.has(t.id)} />}
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#F3EFFC] text-lg">{t.icon}</span>
                    <span className={`min-w-0 flex-1 ${text.body}`}>{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
