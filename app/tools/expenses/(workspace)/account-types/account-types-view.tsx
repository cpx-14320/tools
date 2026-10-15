"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/expenses/page-header";
import { Button, ButtonLink } from "@/components/expenses/button";
import { text } from "@/components/expenses/theme";
import { AccountTypeModal, type AccountTypeModalDraft } from "@/components/expenses/account-type-modal";
import { AccountTypeBatchModal, type AccountTypeBatchItem } from "@/components/expenses/account-type-batch-modal";
import { accountTypesByKind, DEFAULT_ACCOUNT_TYPES, type AccountTypeDTO } from "@/lib/expenses/account-types";

export function AccountTypesView() {
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<AccountTypeDTO | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);

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

  async function handleDelete() {
    if (!modal) return;
    const data: { accountTypes?: AccountTypeDTO[] } = await fetch(`/api/expenses/account-types?id=${modal.id}`, { method: "DELETE" })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.accountTypes) setAccountTypes(data.accountTypes);
    setModal(null);
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
                  <button key={t.id} type="button" onClick={() => setModal(t)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
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
                  <button key={t.id} type="button" onClick={() => setModal(t)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
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
