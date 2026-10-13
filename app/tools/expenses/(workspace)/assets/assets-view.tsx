"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/expenses/page-header";
import { Button } from "@/components/expenses/button";
import { Card, CardBody } from "@/components/expenses/card";
import { IconAvatar } from "@/components/expenses/icon-avatar";
import { text } from "@/components/expenses/theme";
import { AccountModal, type AccountModalDraft } from "@/components/expenses/account-modal";
import { accountsByKind, totalByKind, netWorth, type AccountDTO } from "@/lib/expenses/accounts";
import { formatCurrency } from "@/lib/format";

type ModalState = { mode: "create" } | { mode: "edit"; account: AccountDTO };

export function AssetsView() {
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/expenses/accounts")
      .then((res) => res.json())
      .then((data: { accounts?: AccountDTO[] }) => {
        if (cancelled) return;
        setAccounts(data.accounts ?? []);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(draft: AccountModalDraft) {
    if (!modal) return;
    const method = modal.mode === "edit" ? "PUT" : "POST";
    const body = modal.mode === "edit" ? { id: modal.account.id, ...draft } : draft;
    const data: { accounts?: AccountDTO[] } = await fetch("/api/expenses/accounts", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.accounts) setAccounts(data.accounts);
    setModal(null);
  }

  async function handleDelete() {
    if (modal?.mode !== "edit") return;
    const data: { accounts?: AccountDTO[] } = await fetch(`/api/expenses/accounts?id=${modal.account.id}`, { method: "DELETE" })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.accounts) setAccounts(data.accounts);
    setModal(null);
  }

  const assets = accountsByKind(accounts, "asset");
  const liabilities = accountsByKind(accounts, "liability");
  const net = netWorth(accounts);

  return (
    <div>
      <PageHeader title="資產總表" description="帳戶餘額自己輸入維護，跟消費紀錄的收支流水帳是分開的兩件事" actions={<Button onClick={() => setModal({ mode: "create" })}>＋ 新增帳戶</Button>} />

      <AccountModal
        key={modal ? JSON.stringify(modal) : "closed"}
        open={modal !== null}
        initial={modal?.mode === "edit" ? modal.account : undefined}
        onClose={() => setModal(null)}
        onSave={handleSave}
        onDelete={modal?.mode === "edit" ? handleDelete : undefined}
      />

      {!ready ? (
        <p className={text.faint}>載入中…</p>
      ) : accounts.length === 0 ? (
        <p className={text.faint}>還沒有任何帳戶，點上方新增第一個</p>
      ) : (
        <>
          <Card className="mb-5">
            <CardBody>
              <p className={text.muted}>淨資產</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${net < 0 ? "text-[#D1517E]" : "text-[#4A3B7C]"}`}>{formatCurrency(net)}</p>
              <p className={`mt-1 ${text.muted}`}>
                資產 {formatCurrency(totalByKind(accounts, "asset"))} － 負債 {formatCurrency(totalByKind(accounts, "liability"))}
              </p>
            </CardBody>
          </Card>

          {assets.length > 0 && (
            <div className="mb-5">
              <p className={`mb-2 px-1 ${text.sectionHeading}`}>資產</p>
              <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#ECE4FA] bg-white">
                {assets.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setModal({ mode: "edit", account: a })}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                  >
                    <IconAvatar icon={a.icon} size="sm" />
                    <span className={`min-w-0 flex-1 ${text.body}`}>{a.name}</span>
                    <span className="shrink-0 tabular-nums font-semibold text-[#4A3B7C]">{formatCurrency(a.balance)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {liabilities.length > 0 && (
            <div>
              <p className={`mb-2 px-1 ${text.sectionHeading}`}>負債</p>
              <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#ECE4FA] bg-white">
                {liabilities.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setModal({ mode: "edit", account: a })}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                  >
                    <IconAvatar icon={a.icon} size="sm" />
                    <span className={`min-w-0 flex-1 ${text.body}`}>{a.name}</span>
                    <span className="shrink-0 tabular-nums font-semibold text-[#D1517E]">－{formatCurrency(a.balance)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
