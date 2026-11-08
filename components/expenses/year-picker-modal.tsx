"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "./modal";
import { OptionChip, SegmentedControl } from "./button";
import { text } from "./theme";
import type { YearDeltaMode } from "./year-compare-table";

/** 年度對照表要比哪幾年——基準年一個、比較年可以挑好幾個。
 *
 *  拆成「基準」跟「比較」兩組，而不是一排全部平等的年份：表格上每一欄的增減都是跟基準年
 *  比的，不講清楚誰是基準，三欄以上時那些 ▲▼ 就讀不出是在跟誰比。
 *
 *  版面照其他彈窗的慣例：一組一個小標題、底下一排膠囊，底部是共用的取消／儲存。改完按
 *  儲存才生效——邊挑邊套用的話，挑到一半表格會一直重畫。
 *
 *  膠囊用的是 OptionChip（新增收支紀錄彈窗「項目」那一排同一顆），不是報表上「近 3／6 月」
 *  那種 ChoiceChip：這裡是從一份年份清單裡挑，比較年還可能一年都沒挑，沒挑中的那幾顆
 *  也要讀得清楚。
 *
 *  排法是固定六欄的 grid 而不是 flex-wrap：年份每一顆寬度一樣（都是四位數），用 grid
 *  才會每一列剛好六個、第一顆貼齊左邊、第六顆貼齊右邊、中間等距。flex-wrap 是「排得下
 *  就繼續排」，最後一列會短一截、左右也切不齊。 */
/** 一列六個，欄寬相同所以首尾自然切齊彈窗的左右邊界，中間等距。 */
const YEAR_GRID = "grid grid-cols-6 gap-2";

export function YearPickerModal({
  open,
  availableYears,
  baseYear,
  compareYears,
  deltaMode,
  onClose,
  onSave,
}: {
  open: boolean;
  /** 可以挑的年份，由新到舊。 */
  availableYears: number[];
  baseYear: number;
  compareYears: number[];
  deltaMode: YearDeltaMode;
  onClose: () => void;
  onSave: (next: { baseYear: number; compareYears: number[]; deltaMode: YearDeltaMode }) => void;
}) {
  const [base, setBase] = useState(baseYear);
  const [compare, setCompare] = useState(compareYears);
  const [mode, setMode] = useState<YearDeltaMode>(deltaMode);

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
      footer={<ModalFooter onClose={onClose} onConfirm={() => onSave({ baseYear: base, compareYears: compare, deltaMode: mode })} />}
    >
      <div>
        {/* 金額跟百分比回答的不是同一種問題：「三月比去年多花了 NT$ 1,200」是可以直接
            拿來做決定的數字；「多了 38%」則是在基數差很多的年份之間才看得出意義（今年
            才開始記帳的分類，金額差不大但比例會很誇張）。兩個都留著讓使用者自己選，
            比替他決定一個好。 */}
        {/* 標題講「單位」不講「顯示方式」：底下兩個選項（金額／百分比）本來就是兩種單位，
            「顯示方式」聽起來像在挑顏色或圖表樣式。 */}
        <p className={`mb-2 ${text.label}`}>增減單位</p>
        <SegmentedControl
          className="self-start"
          value={mode}
          onChange={setMode}
          options={[
            { value: "amount", label: "金額" },
            { value: "percent", label: "百分比" },
          ]}
        />
      </div>

      <div>
        <p className={`mb-2 ${text.label}`}>基準年</p>
        <div className={YEAR_GRID}>
          {availableYears.map((y) => (
            <OptionChip key={y} active={y === base} onClick={() => chooseBase(y)}>
              {y}
            </OptionChip>
          ))}
        </div>
      </div>

      <div>
        <p className={`mb-2 ${text.label}`}>比較年（可複選）</p>
        <div className={YEAR_GRID}>
          {availableYears
            .filter((y) => y !== base)
            .map((y) => (
              <OptionChip key={y} active={compare.includes(y)} onClick={() => toggleCompare(y)}>
                {y}
              </OptionChip>
            ))}
        </div>
        {compare.length === 0 && <p className={`mt-2 ${text.faint}`}>一年都沒挑的話，表格只會有基準年那一欄。</p>}
      </div>
    </Modal>
  );
}