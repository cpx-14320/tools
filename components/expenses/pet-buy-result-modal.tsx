"use client";

import { PetModal, PetModalButton } from "./pet-modal";
import { IconImg } from "./icon-img";
import { InlineIcon } from "./icon-avatar";
import { ICON_PATHS } from "./icon-paths";
import { petItemThumb, type PetItem } from "@/lib/expenses/pet";

/** 買到東西之後跳出來的回饋。
 *
 *  **為什麼這個動作要特別跳出來講，其他動作（換裝、餵食）不用**：養成頁的設計原則是
 *  「結果畫面上看得到就不用再疊文字」——換衣服角色當場換一套、餵食經驗條當場往前跑。
 *  但「買」看不到：錢扣掉了、東西進了背包，商店格子上除了多一個勾勾徽章之外沒有別的
 *  變化，使用者容易懷疑「剛剛那下到底有沒有生效」。所以這裡刻意保留一個明確的回饋，
 *  是上面那條原則唯一的例外。
 *
 *  **用法比照設定頁「清除完成」那種一次性結果彈窗**（見 more-view.tsx 的
 *  `ConfirmModal ... onlyAcknowledge`）：動作做完才跳出來、只有一顆按鈕可以按掉，但
 *  樣式換成養成頁自己的插畫框（PetModal）——蓋在商店彈窗上面時如果混進記帳本共用的
 *  白色表單彈窗，會像是從遊戲畫面跳回了另一個 App。 */
export function PetBuyResultModal({
  open,
  item,
  qty,
  totalPrice,
  onClose,
}: {
  open: boolean;
  /** null 代表還沒買過任何東西——彈窗關著時呼叫端不用特地把這個 state 清掉。 */
  item: PetItem | null;
  /** 買了幾份，只有食物會大於 1。 */
  qty: number;
  totalPrice: number;
  onClose: () => void;
}) {
  if (!item) return null;
  const thumb = petItemThumb(item);
  const isFood = item.kind === "食物";

  return (
    <PetModal open={open} onClose={onClose} title="購買成功" footer={<PetModalButton onClick={onClose}>知道了</PetModalButton>}>
      <div className="flex flex-col items-center gap-2 py-2">
        {thumb ? (
          <span className="size-16 shrink-0 rounded-xl border-2 border-[#E3D4F5]" style={{ background: thumb }} />
        ) : (
          <IconImg src={item.image} alt={item.name} size={64} />
        )}
        <p className="text-sm font-bold text-[#5B3B8C]">
          {item.name}
          {isFood && qty > 1 && <span className="tabular-nums"> ×{qty}</span>}
        </p>
        <p className="flex items-center gap-1 text-xs text-[#8A6BBE]">
          花了
          <InlineIcon icon={ICON_PATHS.petStar} className="size-3.5" />
          <span className="tabular-nums">{totalPrice}</span>
        </p>
        {/* 告訴使用者東西去哪了：食物進了餵食欄（養成頁那排固定圖示），服裝／背景買了
            還沒換上（要去背包挑），避免買完之後跑去場地上找卻找不到而以為沒買到。 */}
        <p className="text-center text-[11px] leading-relaxed text-[#9C7FC0]">
          {isFood ? "已經放進餵食欄了" : "已經收進背包了，去背包把它換上吧"}
        </p>
      </div>
    </PetModal>
  );
}
