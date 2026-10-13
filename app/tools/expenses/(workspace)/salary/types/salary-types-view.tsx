"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/expenses/page-header";
import { Button, Badge } from "@/components/expenses/button";
import { text } from "@/components/expenses/theme";
import { SalaryTypeModal } from "@/components/expenses/salary-type-modal";
import { SalaryTypeBatchModal } from "@/components/expenses/salary-type-batch-modal";
import type { SalaryItemKind, SalaryItemTypeDTO } from "@/lib/expenses/salary-types";

export function SalaryTypesView() {
  const [types, setTypes] = useState<SalaryItemTypeDTO[]>([]);
  const [ready, setReady] = useState(false);
  // 編輯既有類型用（點清單裡的一列開啟）；新增走下面的 batchOpen／SalaryTypeBatchModal，
  // 兩種彈窗各自管各自的狀態，不用再共用一個「mode」欄位去分支。
  const [modal, setModal] = useState<SalaryItemTypeDTO | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);

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
    const data: { types?: SalaryItemTypeDTO[] } = await fetch("/api/expenses/salary-types", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: modal.id, name, kind }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.types) setTypes(data.types);
    setModal(null);
  }

  async function handleDelete() {
    if (!modal) return;
    const data: { types?: SalaryItemTypeDTO[] } = await fetch(`/api/expenses/salary-types?id=${modal.id}`, { method: "DELETE" })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.types) setTypes(data.types);
    setModal(null);
  }

  // 批次新增：沿用跟搭乘車「新增分類」一樣的精神——逐筆依序 POST（不是 Promise.all 併發），
  // 因為 createSalaryItemType 的 order 是用當下已存在筆數算出來的，併發送出會拿到同一個
  // order、存檔順序跟畫面排序對不起來；依序送出，每筆都等前一筆真的寫進去後才算下一個 order。
  async function handleBatchSave(items: { name: string; kind: SalaryItemKind }[]) {
    let latest = types;
    for (const item of items) {
      const data: { types?: SalaryItemTypeDTO[] } = await fetch("/api/expenses/salary-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (data.types) latest = data.types;
    }
    setTypes(latest);
    setBatchOpen(false);
  }

  return (
    <div>
      <PageHeader title="薪資明細類型" description="新增後在「薪資紀錄」就能選用" actions={<Button onClick={() => setBatchOpen(true)}>＋ 新增</Button>} />

      <SalaryTypeModal
        key={modal ? modal.id : "closed"}
        open={modal !== null}
        initial={modal ?? undefined}
        onClose={() => setModal(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <SalaryTypeBatchModal open={batchOpen} onClose={() => setBatchOpen(false)} onSave={handleBatchSave} />

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
              onClick={() => setModal(t)}
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
