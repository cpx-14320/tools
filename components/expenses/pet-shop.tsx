"use client";

import { useState } from "react";
import { Modal } from "./modal";
import { Button, SegmentedControl } from "./button";
import { IconImg } from "./icon-img";
import { PetSprite } from "./pet-sprite";
import { text } from "./theme";
import { PET_ITEMS, petItemById, type PetItem, type PetItemKind } from "@/lib/expenses/pet";

interface ShopPetState {
  coins: number;
  outfitId: string;
  ownedOutfitIds: string[];
  foodCounts: Record<string, number>;
}

/** 商店彈窗——比照一般換裝類手遊的商店版面：角色預覽＋星星幣餘額在上面，分類頁籤＋
 *  格狀商品卡在下面（圖＋名稱＋價格，服裝已擁有/穿著中用勾勾徽章、食物用左上角的
 *  持有數量徽章）。
 *
 *  點格子不會立刻花錢：食物／還沒買過的服裝點了只是「選取」，真正扣款要在底下跳出來的
 *  確認列按「確認購買」才算數——食物買進來是進背包（foodCounts），不會順便餵下去，
 *  要吃哪一份、吃幾份是養成頁上那排固定的食物圖示（FoodInventoryRow）的事，兩個動作
 *  分開才不會「一點就整份星星幣飛走」。已經買過的服裝例外：點了直接換上，免費、
 *  隨時可以換回來，不需要再多一次確認。 */
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
  /** 最近一次動作的提示文字，彈窗開著的時候原本頁面底下的訊息看不到，這裡另外顯示一份。 */
  message?: string | null;
  onAct: (action: "buy" | "equip", itemId: string) => void;
}) {
  const [kind, setKind] = useState<PetItemKind>("食物");
  const [selected, setSelected] = useState<string | null>(null);
  const items = PET_ITEMS.filter((i) => i.kind === kind);
  const outfit = petItemById(pet.outfitId);
  const selectedItem = selected ? petItemById(selected) : undefined;
  const canAfford = selectedItem ? pet.coins >= selectedItem.price : false;

  function handleTileClick(item: PetItem) {
    const owned = item.kind === "服裝" && pet.ownedOutfitIds.includes(item.id);
    const equipped = item.id === pet.outfitId;
    if (equipped) return;
    if (owned) {
      setSelected(null);
      onAct("equip", item.id);
      return;
    }
    setSelected(item.id);
  }

  function confirmBuy() {
    if (!selectedItem) return;
    onAct("buy", selectedItem.id);
    // 服裝一買就直接換上，選取面板的任務結束；食物保持選取，方便連續多買幾份。
    if (selectedItem.kind === "服裝") setSelected(null);
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setSelected(null);
        onClose();
      }}
      title="商店"
      fullHeight
      stickyBottom={
        selectedItem && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <IconImg src={selectedItem.image} alt={selectedItem.name} size={36} />
              <div className="min-w-0">
                <p className={`truncate ${text.body}`}>{selectedItem.name}</p>
                <p className={text.muted}>{selectedItem.price === 0 ? "免費" : `⭐ ${selectedItem.price}`}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="ghost" onClick={() => setSelected(null)}>
                取消
              </Button>
              <Button disabled={!canAfford} onClick={confirmBuy}>
                確認購買
              </Button>
            </div>
          </div>
        )
      }
    >
      <div className="rounded-2xl bg-gradient-to-b from-[#F3EFFC] to-[#FDF5F8] px-3 pt-4">
        <PetSprite mood="idle" hueRotate={outfit?.hueRotate ?? 0} size={140} />
      </div>

      {message && <div className="rounded-2xl bg-[#F3EFFC] px-4 py-2.5 text-center text-xs text-[#4A3B7C]">{message}</div>}

      <div className="flex items-center justify-between">
        <SegmentedControl
          value={kind}
          onChange={(next) => {
            setKind(next);
            setSelected(null);
          }}
          options={[
            { value: "食物", label: "食物" },
            { value: "服裝", label: "服裝" },
          ]}
        />
        <span className="text-sm font-semibold tabular-nums text-[#6F5FD6]">⭐ {pet.coins}</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {items.map((item) => (
          <ShopTile key={item.id} item={item} pet={pet} selected={item.id === selected} onClick={() => handleTileClick(item)} />
        ))}
      </div>
    </Modal>
  );
}

function ShopTile({ item, pet, selected, onClick }: { item: PetItem; pet: ShopPetState; selected: boolean; onClick: () => void }) {
  const owned = item.kind === "服裝" && pet.ownedOutfitIds.includes(item.id);
  const equipped = item.id === pet.outfitId;
  const count = item.kind === "食物" ? (pet.foodCounts[item.id] ?? 0) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={equipped}
      className={`relative flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 text-center transition-colors ${
        equipped || selected ? "border-[#6F5FD6] bg-[#F3EFFC]" : "border-[#ECE4FA] bg-white"
      }`}
    >
      {(owned || equipped) && (
        <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-[#6F5FD6] text-white">
          <span aria-hidden className="text-[10px] leading-none">
            ✓
          </span>
        </span>
      )}
      {count > 0 && (
        <span className="absolute left-1.5 top-1.5 grid min-w-5 place-items-center rounded-full bg-[#4A3B7C] px-1 text-[10px] font-semibold leading-4 text-white">
          ×{count}
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
