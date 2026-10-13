"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/expenses/page-header";
import { Button, Badge } from "@/components/expenses/button";
import { text } from "@/components/expenses/theme";
import { SalaryTypeModal } from "@/components/expenses/salary-type-modal";
import type { SalaryItemKind, SalaryItemTypeDTO } from "@/lib/expenses/salary-types";

type ModalState = { mode: "create" } | { mode: "edit"; type: SalaryItemTypeDTO };

export function SalaryTypesView() {
  const [types, setTypes] = useState<SalaryItemTypeDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/expenses/salary-types")
      .then((res) => res.json())
      .then((data: { types?: SalaryItemTypeDTO[] }) => {
        if (cancelled) return;
        setTypes(data.types ?? []);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(name: string, kind: SalaryItemKind) {
    if (!modal) return;
    if (modal.mode === "edit") {
      const data: { types?: SalaryItemTypeDTO[] } = await fetch("/api/expenses/salary-types", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: modal.type.id, name, kind }),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (data.types) setTypes(data.types);
    } else {
      const data: { types?: SalaryItemTypeDTO[] } = await fetch("/api/expenses/salary-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kind }),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (data.types) setTypes(data.types);
    }
    setModal(null);
  }

  async function handleDelete() {
    if (modal?.mode !== "edit") return;
    const data: { types?: SalaryItemTypeDTO[] } = await fetch(`/api/expenses/salary-types?id=${modal.type.id}`, { method: "DELETE" })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.types) setTypes(data.types);
    setModal(null);
  }

  return (
    <div>
      <PageHeader title="薪資明細類型" description="新增後在「薪資紀錄」就能選用" actions={<Button onClick={() => setModal({ mode: "create" })}>＋ 新增</Button>} />

      <SalaryTypeModal
        key={modal ? JSON.stringify(modal) : "closed"}
        open={modal !== null}
        initial={modal?.mode === "edit" ? modal.type : undefined}
        onClose={() => setModal(null)}
        onSave={handleSave}
        onDelete={modal?.mode === "edit" ? handleDelete : undefined}
      />

      {!ready ? (
        <p className={text.faint}>載入中…</p>
      ) : types.length === 0 ? (
        <p className={text.faint}>還沒有任何類型，點上方新增第一個</p>
      ) : (
        <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl border border-[#ECE4FA] bg-white">
          {types.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setModal({ mode: "edit", type: t })}
              className="flex w-full items-center justify-between px-4 py-3.5 text-left"
            >
              <span className={text.body}>{t.name}</span>
              <Badge tone={t.kind === "扣項" ? "negative" : "positive"}>{t.kind}</Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
