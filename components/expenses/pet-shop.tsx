"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "./modal";
import { AmountKeypad, evaluateExpr } from "./amount-keypad";
import { IconButton } from "./icon-button";
import { Button, SegmentedControl } from "./button";
import { IconImg } from "./icon-img";
import { PetSprite, type PetStage } from "./pet-sprite";
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
  stage,
  message,
  onAct,
}: {
  open: boolean;
  onClose: () => void;
  pet: ShopPetState;
  /** 預覽要畫蛋還是角色，由呼叫端依等級決定（見 pet-sprite.ts 的 petStage）。 */
  stage: PetStage;
  /** 最近一次動作的提示文字，彈窗開著的時候原本頁面底下的訊息看不到，這裡另外顯示一份。 */
  message?: string | null;
  /** 食物可以一次買好幾份，count 只對食物有意義（服裝／背景固定一份）。 */
  onAct: (action: "buy" | "equip", itemId: string, count?: number) => void;
}) {
  const [kind, setKind] = useState<PetItemKind>("食物");
  const [selected, setSelected] = useState<string | null>(null);
  // 要買幾份（只有食物會用到）。選別的品項時歸 1，不要把上一個品項的數量帶過去。
  const [qty, setQty] = useState(1);
  // 直接打數字用的小鍵盤彈窗——不用原生 <input type="number">：它在手機上會跳出系統鍵盤，
  // 跟記帳本其他輸入金額的地方（新增交易、存入、對帳）用的自製鍵盤長得完全不一樣。
  const [qtyKeypadOpen, setQtyKeypadOpen] = useState(false);
  const items = PET_ITEMS.filter((i) => i.kind === kind);
  const outfit = petItemById(pet.outfitId);
  const selectedItem = selected ? petItemById(selected) : undefined;
  const isFood = selectedItem?.kind === "食物";
  // 食物看的是「買這麼多份夠不夠」，不是單價夠不夠。
  const totalPrice = selectedItem ? selectedItem.price * (isFood ? qty : 1) : 0;
  const canAfford = selectedItem ? pet.coins >= totalPrice : false;

  function handleTileClick(item: PetItem) {
    const wearable = wearableState(item, pet);
    if (wearable?.equipped) return;
    if (wearable?.owned) {
      setSelected(null);
      onAct("equip", item.id);
      return;
    }
    setSelected(item.id);
    setQty(1);
  }

  function confirmBuy() {
    if (!selectedItem) return;
    onAct("buy", selectedItem.id, isFood ? qty : 1);
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
                {/* 買好幾份時顯示的是總價——單價寫在商品格子上，這裡要回答的是「這次要花多少」。 */}
                <p className={text.muted}>{totalPrice === 0 ? "免費" : `⭐ ${totalPrice}`}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {/* 數量：減、數字、加。數字本身可以點，開小鍵盤直接打（一次買 20 份時
                  按 19 下加號太荒謬）。只有食物有數量，服裝／背景買一份就永久擁有。 */}
              {isFood && (
                <span className="flex shrink-0 items-center gap-1">
                  <IconButton icon="minus" tone="soft" size={28} iconSize={11} aria-label="減少一份" disabled={qty <= 1} onClick={() => setQty((n) => Math.max(1, n - 1))} />
                  <button
                    type="button"
                    onClick={() => setQtyKeypadOpen(true)}
                    aria-label="輸入數量"
                    className="min-w-9 rounded-full bg-[#F3EFFC] px-2 py-1 text-sm font-semibold tabular-nums text-[#4A3B7C]"
                  >
                    {qty}
                  </button>
                  <IconButton icon="plus" tone="soft" size={28} iconSize={11} aria-label="增加一份" disabled={qty >= 99} onClick={() => setQty((n) => Math.min(99, n + 1))} />
                </span>
              )}
              <Button variant="ghost" onClick={() => setSelected(null)}>
                取消
              </Button>
              <Button disabled={!canAfford} onClick={confirmBuy}>
                儲存
              </Button>
            </div>
          </div>
        )
      }
    >
      {/* 跟養成頁的場地一樣是固定高度、角色置中，只是矮一點——彈窗裡還要放頁籤跟
          商品格子，預覽佔太高的話下面就只剩一點點位置。 */}
      <div className="grid h-36 w-full place-items-center rounded-2xl p-3" style={{ background: petBackground(pet.backgroundId) }}>
        <PetSprite stage={stage} mood="idle" hueRotate={outfit?.hueRotate ?? 0} size={96} />
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

      {/* key 綁目前數量：彈窗是常駐掛著、只靠 open 切換顯示的，不換 key 的話裡面的
          useState 只會在第一次掛載時初始化，第二次打開看到的還是上一次的數字。 */}
      <QtyKeypadModal key={`qty-${qty}`} open={qtyKeypadOpen} initial={qty} onClose={() => setQtyKeypadOpen(false)} onSave={setQty} />
    </Modal>
  );
}

/** 直接打數量用的小鍵盤彈窗——跟記帳本其他輸入金額的地方（新增交易、存入、對帳）同一個
 *  AmountKeypad，不用原生 `<input type="number">`：那個在手機上跳的是系統鍵盤，跟整個
 *  記帳本的輸入體驗對不上，而且在這種第二層彈窗裡還會把版面頂掉。 */
function QtyKeypadModal({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: number;
  onClose: () => void;
  onSave: (qty: number) => void;
}) {
  const [expr, setExpr] = useState(String(initial));
  const value = evaluateExpr(expr);
  // 1～99，跟伺服器端的上限一致（見 app/api/expenses/pet/route.ts）。
  const canSave = Number.isFinite(value) && value >= 1 && value <= 99;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="要買幾份"
      stickyBottom={<AmountKeypad expr={expr} onExprChange={setExpr} label="數量" prefix="" />}
      footer={
        <ModalFooter
          onClose={onClose}
          onConfirm={() => {
            onSave(Math.floor(value));
            onClose();
          }}
          confirmDisabled={!canSave}
        />
      }
    >
      <></>
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
