"use client";

import { BottomSheetModal } from "./bottom-sheet-modal";
import { FaIcon } from "./fa-icon";
import { ScrollList, ScrollListRow } from "./ui";
import { colors, copy, text } from "./theme";
import { countOfGroup, groupsSorted, type BasketState } from "@/lib/freshwise/basket";

/**
 * 「要加到哪一個分類」的選擇器（行情頁按種子袋時用）。
 *
 * 以前按下去一律丟進第一個分類——使用者分了「每週常買」「火鍋」，加的東西卻全部掉進
 * 第一個，等於那個分類沒有用。只有一個分類時不會出現這個彈窗（沒有東西要選）。
 */
export function GroupPickerModal({
  open,
  basket,
  itemName,
  onClose,
  onPick,
}: {
  open: boolean;
  basket: BasketState;
  itemName: string;
  onClose: () => void;
  onPick: (groupId: string) => void;
}) {
  const groups = groupsSorted(basket);
  return (
    <BottomSheetModal open={open} title={`把「${itemName}」加到…`} onClose={onClose} bodyClassName="flex flex-col gap-3 px-5 py-5">
      <ScrollList divided>
        {groups.map((group) => (
          <ScrollListRow key={group.id} onClick={() => onPick(group.id)}>
            <span className="flex min-w-0 items-center gap-2.5">
              <FaIcon icon={group.icon} size={32} color={colors.brand} />
              <span className={`truncate ${text.bodyStrong}`}>{group.name}</span>
            </span>
            <span className={text.meta}>
              {countOfGroup(basket, group.id)} {copy.entry}
            </span>
          </ScrollListRow>
        ))}
      </ScrollList>
    </BottomSheetModal>
  );
}
