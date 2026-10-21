"use client";

import { useState } from "react";
import { Modal } from "./modal";
import { SegmentedControl } from "./button";
import { IconImg } from "./icon-img";
import { PetSprite } from "./pet-sprite";
import { PET_ITEMS, petItemById, type PetItem, type PetItemKind } from "@/lib/expenses/pet";

interface ShopPetState {
  coins: number;
  outfitId: string;
  ownedOutfitIds: string[];
}

/** 商店彈窗——比照一般換裝類手遊的商店版面：角色預覽＋星星幣餘額在上面，分類頁籤＋
 *  格狀商品卡在下面（圖＋名稱＋價格），不是記帳本其他頁面慣用的條列列表。每一格點了
 *  就立刻生效（餵食／購買／換上），沒有另外的「加入購物車」流程——品項數量不多，
 *  即時回饋比湊單結帳更直覺。 */
export function PetShopModal({
  open,
  onClose,
  pet,
  message,
  onAct,
}: {
  open: boolean;
  onClose: () => void;
  pet: ShopPetState;
  /** 最近一次動作的提示文字（例如「餵了飯糰，經驗值 +10」），彈窗開著的時候原本頁面
   *  底下的訊息看不到，所以在這裡另外顯示一份。 */
  message?: string | null;
  onAct: (action: "feed" | "buy" | "equip", itemId: string) => void;
}) {
  const [kind, setKind] = useState<PetItemKind>("食物");
  const items = PET_ITEMS.filter((i) => i.kind === kind);
  const outfit = petItemById(pet.outfitId);

  return (
    <Modal open={open} onClose={onClose} title="商店" fullHeight>
      <div className="rounded-2xl bg-gradient-to-b from-[#F3EFFC] to-[#FDF5F8] px-3 pt-4">
        <PetSprite mood="idle" hueRotate={outfit?.hueRotate ?? 0} size={140} />
      </div>

      {message && <div className="rounded-2xl bg-[#F3EFFC] px-4 py-2.5 text-center text-xs text-[#4A3B7C]">{message}</div>}

      <div className="flex items-center justify-between">
        <SegmentedControl
          value={kind}
          onChange={setKind}
          options={[
            { value: "食物", label: "食物" },
            { value: "服裝", label: "服裝" },
          ]}
        />
        <span className="text-sm font-semibold tabular-nums text-[#6F5FD6]">⭐ {pet.coins}</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {items.map((item) => (
          <ShopTile key={item.id} item={item} pet={pet} onAct={onAct} />
        ))}
      </div>
    </Modal>
  );
}

function ShopTile({ item, pet, onAct }: { item: PetItem; pet: ShopPetState; onAct: (action: "feed" | "buy" | "equip", itemId: string) => void }) {
  const owned = item.kind === "服裝" && pet.ownedOutfitIds.includes(item.id);
  const equipped = item.id === pet.outfitId;
  const affordable = pet.coins >= item.price;
  const disabled = item.kind === "食物" ? !affordable : equipped || (!owned && !affordable);

  function handleClick() {
    if (item.kind === "食物") {
      if (affordable) onAct("feed", item.id);
      return;
    }
    if (equipped) return;
    if (owned) onAct("equip", item.id);
    else if (affordable) onAct("buy", item.id);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`relative flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 text-center transition-colors ${
        equipped ? "border-[#6F5FD6] bg-[#F3EFFC]" : "border-[#ECE4FA] bg-white"
      } ${disabled && !equipped ? "opacity-50" : ""}`}
    >
      {(owned || equipped) && (
        <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-[#6F5FD6] text-white">
          <span aria-hidden className="text-[10px] leading-none">
            ✓
          </span>
        </span>
      )}
      <IconImg src={item.image} alt={item.name} size={56} />
      <span className="line-clamp-1 w-full text-xs font-semibold text-[#4A3B7C]">{item.name}</span>
      <span className="text-[11px] font-medium text-[#9C94C4]">
        {equipped ? "穿著中" : owned ? "點擊換上" : item.price === 0 ? "免費" : `⭐ ${item.price}`}
      </span>
    </button>
  );
}
