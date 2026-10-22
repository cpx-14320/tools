"use client";

import { useState } from "react";
import { Modal } from "./modal";
import { Button, SegmentedControl } from "./button";
import { IconImg } from "./icon-img";
import { PetSprite } from "./pet-sprite";
import { text } from "./theme";
import { PET_ITEMS, petBackground, petItemById, type PetItem, type PetItemKind } from "@/lib/expenses/pet";

interface ShopPetState {
  coins: number;
  outfitId: string;
  ownedOutfitIds: string[];
  backgroundId: string;
  ownedBackgroundIds: string[];
  foodCounts: Record<string, number>;
}

/** 服裝跟背景在商店裡的行為一樣（買過就永久擁有、點一下換上），差別只在看哪個欄位。
 *  食物不走這條（可以重複買、會被吃掉），所以回傳 null。
 *
 *  免費的那一件一律算已擁有，跟後端 ownedList() 同一套規則——兩邊判斷不一致的話，
 *  畫面會顯示「可購買」但送出去被擋下來。 */
function wearableState(item: PetItem, pet: ShopPetState): { owned: boolean; equipped: boolean } | null {
  if (item.kind === "服裝") return { owned: item.price === 0 || pet.ownedOutfitIds.includes(item.id), equipped: pet.outfitId === item.id };
  if (item.kind === "背景") return { owned: item.price === 0 || pet.ownedBackgroundIds.includes(item.id), equipped: pet.backgroundId === item.id };
  return null;
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
    const wearable = wearableState(item, pet);
    if (wearable?.equipped) return;
    if (wearable?.owned) {
      setSelected(null);
      onAct("equip", item.id);
      return;
    }
    setSelected(item.id);
  }

  function confirmBuy() {
    if (!selectedItem) return;
    onAct("buy", selectedItem.id);
    // 服裝／背景一買就直接換上，選取面板的任務結束；食物保持選取，方便連續多買幾份。
    if (selectedItem.kind !== "食物") setSelected(null);
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
              {selectedItem.kind === "背景" ? (
                <span className="size-9 shrink-0 rounded-lg border border-[#ECE4FA]" style={{ background: selectedItem.background }} />
              ) : (
                <IconImg src={selectedItem.image} alt={selectedItem.name} size={36} />
              )}
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
      {/* 跟養成頁的場地一樣是 1:1，只是限一個最大寬度——彈窗裡還要放頁籤跟商品格子，
          讓預覽撐滿整個寬度的話下面就只剩一點點位置。 */}
      <div className="mx-auto aspect-square w-full max-w-[200px] rounded-2xl p-3" style={{ background: petBackground(pet.backgroundId) }}>
        <PetSprite mood="idle" hueRotate={outfit?.hueRotate ?? 0} />
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
            { value: "背景", label: "背景" },
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
  const wearable = wearableState(item, pet);
  const owned = wearable?.owned ?? false;
  const equipped = wearable?.equipped ?? false;
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
      {/* 背景直接把漸層畫出來當縮圖——它本來就是一塊顏色，比起放一張圖更準確。 */}
      {item.kind === "背景" ? (
        <span className="size-14 rounded-xl border border-[#ECE4FA]" style={{ background: item.background }} />
      ) : (
        <IconImg src={item.image} alt={item.name} size={56} />
      )}
      <span className="line-clamp-1 w-full text-xs font-semibold text-[#4A3B7C]">
        {item.name}
        {/* 持有數量接在名稱後面（飯糰 ×3），不另外做徽章——跟養成頁那排食物同一個寫法。 */}
        {count > 0 && <span className="tabular-nums"> ×{count}</span>}
      </span>
      <span className="text-[11px] font-medium text-[#9C94C4]">
        {equipped ? (item.kind === "背景" ? "使用中" : "穿著中") : owned ? "點擊換上" : item.price === 0 ? "免費" : `⭐ ${item.price}`}
      </span>
    </button>
  );
}
