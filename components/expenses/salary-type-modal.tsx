"use client";

import { useState } from "react";
import { Button, SegmentedControl } from "./button";
import { Modal, Field, fieldInputClass } from "./modal";
import type { SalaryItemKind } from "@/lib/expenses/salary-types";

export function SalaryTypeModal({
  open,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  initial?: { name: string; kind: SalaryItemKind };
  onClose: () => void;
  onSave: (name: string, kind: SalaryItemKind) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<SalaryItemKind>(initial?.kind ?? "加項");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "編輯薪資明細類型" : "新增薪資明細類型"}
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
            <Button disabled={!name.trim()} onClick={() => onSave(name.trim(), kind)}>
              儲存
            </Button>
          </div>
        </>
      }
    >
      <Field label="名稱">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如「本薪」「獎金」" className={fieldInputClass} />
      </Field>
      <Field label="類型">
        <SegmentedControl
          className="self-start"
          value={kind}
          onChange={setKind}
          options={[
            { value: "加項", label: "加項" },
            { value: "扣項", label: "扣項" },
          ]}
        />
      </Field>
    </Modal>
  );
}
