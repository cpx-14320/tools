"use client";

import { BottomSheetModal } from "./bottom-sheet-modal";
import { FaIcon } from "./fa-icon";
import { ScrollList, ScrollListRow } from "./ui";
import { colors, copy, text } from "./theme";

/**
 * 「從幾個選項挑一個」的共用彈窗（價格單位、提醒門檻…）。
 *
 * 設定頁本來有三種挑選介面並存：場所用 SegmentedTabs、市場用 MarketPickerModal、
 * 單位與門檻又各自一排 SegmentedTabs。同一件事（挑一個值）長三種樣子，使用者每一區
 * 都要重新認一次操作方式。除了場所那種「一眼看完三個」的之外，一律走這顆。
 */
export function OptionPickerModal<T extends string>({
  open,
  title,
  value,
  options,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  value: T;
  options: readonly { key: T; label: string; note?: string }[];
  onClose: () => void;
  onConfirm: (key: T) => void;
}) {
  return (
    <BottomSheetModal open={open} title={title} onClose={onClose} bodyClassName="flex flex-col gap-3 px-5 py-5">
      <ScrollList divided>
        {options.map((option) => (
          <ScrollListRow
            key={option.key}
            onClick={() => {
              onConfirm(option.key);
              onClose();
            }}
          >
            <span className="min-w-0 flex-1">
              <span className={text.bodyStrong}>{option.label}</span>
              {option.note && <span className={`block ${text.meta}`}>{option.note}</span>}
            </span>
            {value === option.key && <FaIcon icon="check" size={13} color={colors.brand} />}
          </ScrollListRow>
        ))}
      </ScrollList>
      <span className="sr-only">{copy.confirm}</span>
    </BottomSheetModal>
  );
}
