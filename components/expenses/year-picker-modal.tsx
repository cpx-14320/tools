"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "./modal";
import { ChoiceChip } from "./button";
import { text } from "./theme";

/** 年度對照表要比哪幾年——基準年一個、比較年可以挑好幾個。
 *
 *  拆成「基準」跟「比較」兩組，而不是一排全部平等的年份：表格上每一欄的增減都是跟基準年
 *  比的，不講清楚誰是基準，三欄以上時那些 ▲▼ 就讀不出是在跟誰比。
 *
 *  版面照其他彈窗的慣例：一組一個小標題、底下一排膠囊（跟報表的「近 3／6 月」、年份膠囊
 *  同一顆 ChoiceChip），底部是共用的取消／儲存。改完按儲存才生效——邊挑邊套用的話，
 *  挑到一半表格會一直重畫。 */
export function YearPickerModal({
  open,
  availableYears,
  baseYear,
  compareYears,
  onClose,
  onSave,
}: {
  open: boolean;
  /** 可以挑的年份，由新到舊。 */
  availableYears: number[];
  baseYear: number;
  compareYears: number[];
  onClose: () => void;
  onSave: (next: { baseYear: number; compareYears: number[] }) => void;
}) {
  const [base, setBase] = useState(baseYear);
  const [compare, setCompare] = useState(compareYears);

  /** 換基準年時，如果新的基準年原本在比較年裡就把它移出來——同一年不能既是基準又是比較，
   *  表格會出現兩欄一樣的數字。 */
  function chooseBase(year: number) {
    setBase(year);
    setCompare((cur) => cur.filter((y) => y !== year));
  }

  function toggleCompare(year: number) {
    setCompare((cur) => (cur.includes(year) ? cur.filter((y) => y !== year) : [...cur, year]));
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="選擇年份"
      footer={<ModalFooter onClose={onClose} onConfirm={() => onSave({ baseYear: base, compareYears: compare })} />}
    >
      <div>
        <p className={`mb-2 ${text.label}`}>基準年</p>
        <p className={`mb-2 ${text.muted}`}>表格上每一欄的增減都是跟這一年比。</p>
        <div className="flex flex-wrap gap-1.5">
          {availableYears.map((y) => (
            <ChoiceChip key={y} active={y === base} onClick={() => chooseBase(y)}>
              {y}
            </ChoiceChip>
          ))}
        </div>
      </div>

      <div>
        <p className={`mb-2 ${text.label}`}>比較年（可複選）</p>
        <div className="flex flex-wrap gap-1.5">
          {availableYears
            .filter((y) => y !== base)
            .map((y) => (
              <ChoiceChip key={y} active={compare.includes(y)} onClick={() => toggleCompare(y)}>
                {y}
              </ChoiceChip>
            ))}
        </div>
        {compare.length === 0 && <p className={`mt-2 ${text.faint}`}>一年都沒挑的話，表格只會有基準年那一欄。</p>}
      </div>
    </Modal>
  );
}
