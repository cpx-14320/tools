"use client";

import { useState } from "react";
import { PetModal, PetModalButton } from "./pet-modal";
import { PetTabs, petThumbClass, petTileClass, petTileLabelClass, petTileNoteClass } from "./pet-ui";
import { AmountKeypad, evaluateExpr } from "./amount-keypad";
import { IconButton } from "./icon-button";
import { IconImg } from "./icon-img";
import { PET_ITEMS, PET_HATCH_LEVEL, effectiveOutfitId, outfitUnlocked, petItemById, petItemThumb, type PetItem, type PetItemKind } from "@/lib/expenses/pet";

interface ShopPetState {
  coins: number;
  outfitId: string;
  ownedOutfitIds: string[];
  backgroundId: string;
  ownedBackgroundIds: string[];
  ownedStateIds: string[];
  foodCounts: Record<string, number>;
}

/** 服裝跟背景在商店裡的行為一樣（買過就永久擁有、點一下換上），差別只在看哪個欄位。
 *  食物不走這條（可以重複買、會被吃掉），所以回傳 null。
 *
 *  免費的那一件一律算已擁有，跟後端 ownedList() 同一套規則——兩邊判斷不一致的話，
 *  畫面會顯示「可購買」但送出去被擋下來。 */
function wearableState(item: PetItem, pet: ShopPetState, level: number): { owned: boolean; equipped: boolean } | null {
  // 狀態買一次就永久擁有，但它是複選的、沒有「正在使用」這回事（勾選在背包裡做）。
  if (item.kind === "狀態") return { owned: pet.ownedStateIds.includes(item.id), equipped: false };
  if (item.kind === "服裝") {
    // equipped 比的是畫面上實際穿著的那套（等級不夠時是蛋），理由同 pet-bag-modal 的 ownedState。
    return { owned: item.price === 0 || pet.ownedOutfitIds.includes(item.id), equipped: effectiveOutfitId(pet.outfitId, level) === item.id };
  }
  if (item.kind === "背景") return { owned: item.price === 0 || pet.ownedBackgroundIds.includes(item.id), equipped: pet.backgroundId === item.id };
  return null;
}

/** 商店彈窗——比照一般換裝類手遊的商店版面：角色預覽＋星星幣餘額在上面，分類頁籤＋
 *  格狀商品卡在下面（圖＋名稱＋價格，服裝已擁有/穿著中用勾勾徽章、食物用左上角的
 *  持有數量徽章）。
 *
 *  **這裡只負責買**，不負責換裝：已經擁有的服裝／背景點了不做事，要換去背包
 *  （PetBagModal）。拆開之後商店裡的每一格一定是花錢、背包裡的每一格一定是免費，
 *  不用在點下去之前先想「這件我買過了嗎」。
 *
 *  點格子不會立刻花錢：食物／還沒買過的服裝點了只是「選取」，真正扣款要在底下跳出來的
 *  確認列按「確認購買」才算數——食物買進來是進背包（foodCounts），不會順便餵下去，
 *  要吃哪一份、吃幾份是養成頁上那排固定的食物圖示的事，兩個動作分開才不會「一點就
 *  整份星星幣飛走」。 */
export function PetShopModal({
  open,
  onClose,
  pet,
  level,
  onAct,
}: {
  open: boolean;
  onClose: () => void;
  pet: ShopPetState;
  /** 目前等級——決定造型格子要不要標「Lv.10 解鎖」。 */
  level: number;
  /** 食物可以一次買好幾份，count 只對食物有意義（服裝／背景固定一份）。 */
  onAct: (action: "buy", itemId: string, count?: number) => void;
}) {
  const [kind, setKind] = useState<PetItemKind>("食物");
  const [selected, setSelected] = useState<string | null>(null);
  // 要買幾份（只有食物會用到）。選別的品項時歸 1，不要把上一個品項的數量帶過去。
  const [qty, setQty] = useState(1);
  // 直接打數字用的小鍵盤彈窗——不用原生 <input type="number">：它在手機上會跳出系統鍵盤，
  // 跟記帳本其他輸入金額的地方（新增交易、存入、對帳）用的自製鍵盤長得完全不一樣。
  const [qtyKeypadOpen, setQtyKeypadOpen] = useState(false);
  // 狀態只賣「動作狀態」：孵化那種紀念狀態是等級解鎖的，不賣（見 lib/expenses/pet.ts）。
  const items = PET_ITEMS.filter((i) => i.kind === kind && (i.kind !== "狀態" || i.action));
  const selectedItem = selected ? petItemById(selected) : undefined;
  const selectedThumb = selectedItem ? petItemThumb(selectedItem) : null;
  const isFood = selectedItem?.kind === "食物";
  // 食物看的是「買這麼多份夠不夠」，不是單價夠不夠。
  const totalPrice = selectedItem ? selectedItem.price * (isFood ? qty : 1) : 0;
  const canAfford = selectedItem ? pet.coins >= totalPrice : false;

  function handleTileClick(item: PetItem) {
    // 已經買過的服裝／背景在商店裡只是標示「已擁有」，點了不做事——換裝是背包的工作
    // （見 PetBagModal）。本來點了會直接換上，結果同一個格子有時候扣錢有時候換裝，
    // 差別只在這件有沒有買過，猜錯就是星星幣飛走。
    if (wearableState(item, pet, level)?.owned) return;
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
    <PetModal
      open={open}
      onClose={() => {
        setSelected(null);
        onClose();
      }}
      title="商店"
      subtitle={`⭐ ${pet.coins}`}
      footer={
        // 選好一格之後才長出來的購買列。釘在框底（PetModal 的 footer 不跟著捲），
        // 不然在十幾格的清單裡選完要按的按鈕會跟著內容捲走。
        selectedItem ? (
          <div className="flex flex-col gap-2 rounded-2xl border-2 border-[#E3D4F5] bg-white/85 p-2">
            <div className="flex items-center gap-2">
              {selectedThumb ? (
                <span className="size-9 shrink-0 rounded-lg border border-[#E3D4F5]" style={{ background: selectedThumb }} />
              ) : (
                <IconImg src={selectedItem.image} alt={selectedItem.name} size={36} />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-[#5B3B8C]">{selectedItem.name}</p>
                {/* 買好幾份時顯示的是總價——單價寫在商品格子上，這裡要回答的是「這次要花多少」。 */}
                <p className={petTileNoteClass}>{totalPrice === 0 ? "免費" : `⭐ ${totalPrice}`}</p>
              </div>
              {/* 數量：減、數字、加。數字本身可以點，開小鍵盤直接打（一次買 20 份時
                  按 19 下加號太荒謬）。只有食物有數量，服裝／背景買一份就永久擁有。 */}
              {isFood && (
                <span className="flex shrink-0 items-center gap-1">
                  <IconButton icon="minus" tone="soft" size={26} iconSize={10} aria-label="減少一份" disabled={qty <= 1} onClick={() => setQty((n) => Math.max(1, n - 1))} />
                  <button
                    type="button"
                    onClick={() => setQtyKeypadOpen(true)}
                    aria-label="輸入數量"
                    className="min-w-8 rounded-full bg-[#F1E7FD] px-2 py-1 text-xs font-bold tabular-nums text-[#5B3B8C]"
                  >
                    {qty}
                  </button>
                  <IconButton icon="plus" tone="soft" size={26} iconSize={10} aria-label="增加一份" disabled={qty >= 99} onClick={() => setQty((n) => Math.min(99, n + 1))} />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <PetModalButton tone="secondary" onClick={() => setSelected(null)}>
                取消
              </PetModalButton>
              <PetModalButton disabled={!canAfford} onClick={confirmBuy}>
                {canAfford ? "確認購買" : "星星幣不夠"}
              </PetModalButton>
            </div>
          </div>
        ) : undefined
      }
    >
      <PetTabs
        value={kind}
        onChange={(next) => {
          setKind(next);
          setSelected(null);
        }}
        options={[
          { value: "食物", label: "食物" },
          { value: "服裝", label: "服裝" },
          { value: "背景", label: "背景" },
          { value: "狀態", label: "狀態" },
        ]}
      />

      {/* 食物三欄（圖小、只要看得出是哪一種），服裝跟背景兩欄——它們的縮圖是整張場景圖
          跟整個角色，裁進三欄的小格子裡看不出差別（跟背包同一個理由）。 */}
      {items.length === 0 ? (
        // 目前只有狀態會是空的：圖還在畫，先讓這一頁存在，使用者知道之後會有東西。
        <p className="text-center text-xs text-[#9C7FC0]">準備中。</p>
      ) : (
        <div className={`grid gap-2 ${kind === "食物" ? "grid-cols-3" : "grid-cols-2"}`}>
          {items.map((item) => (
            <ShopTile key={item.id} item={item} pet={pet} level={level} selected={item.id === selected} onClick={() => handleTileClick(item)} />
          ))}
        </div>
      )}

      {/* key 綁目前數量：彈窗是常駐掛著、只靠 open 切換顯示的，不換 key 的話裡面的
          useState 只會在第一次掛載時初始化，第二次打開看到的還是上一次的數字。 */}
      <QtyKeypadModal key={`qty-${qty}`} open={qtyKeypadOpen} initial={qty} onClose={() => setQtyKeypadOpen(false)} onSave={setQty} />
    </PetModal>
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
    // 跟商店、背包、簽到同一個插畫框：它是從商店裡再開一層的彈窗，長成白色表單的話，
    // 使用者會以為自己跳出遊戲畫面了（養成頁的彈窗統一走 PetModal）。
    <PetModal
      open={open}
      onClose={onClose}
      title="要買幾份"
      footer={
        <div className="flex items-center gap-2">
          <PetModalButton tone="secondary" onClick={onClose}>
            取消
          </PetModalButton>
          <PetModalButton
            disabled={!canSave}
            onClick={() => {
              onSave(Math.floor(value));
              onClose();
            }}
          >
            確定
          </PetModalButton>
        </div>
      }
    >
      <AmountKeypad expr={expr} onExprChange={setExpr} label="數量" prefix="" />
    </PetModal>
  );
}

function ShopTile({
  item,
  pet,
  level,
  selected,
  onClick,
}: {
  item: PetItem;
  pet: ShopPetState;
  level: number;
  selected: boolean;
  onClick: () => void;
}) {
  const wearable = wearableState(item, pet, level);
  const owned = wearable?.owned ?? false;
  const equipped = wearable?.equipped ?? false;
  const count = item.kind === "食物" ? (pet.foodCounts[item.id] ?? 0) : 0;
  const thumb = petItemThumb(item);
  // 還沒孵化的造型照樣買得到（先買起來放），只是買完不會自動換上，格子上標幾級才穿得上。
  const locked = item.kind === "服裝" && !outfitUnlocked(item, level);

  return (
    <button type="button" onClick={onClick} disabled={equipped} className={petTileClass({ selected: equipped || selected })}>
      {(owned || equipped) && (
        <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-[#9B7BD6] text-white">
          <span aria-hidden className="text-[10px] leading-none">
            ✓
          </span>
        </span>
      )}
      {/* 背景跟服裝的縮圖都是那張大圖裁出來的（背景置中裁成方形、服裝取精靈圖的第一格），
          不走 IconImg——IconImg 是 contain，整張塞進方框會留白或縮成一排小人。
          寬度跟著格子走（兩欄的格子比食物那欄寬很多），高度用 aspect-square 鎖住比例。 */}
      {thumb ? (
        <span className={petThumbClass} style={{ background: thumb }} />
      ) : (
        <IconImg src={item.image} alt={item.name} size={52} />
      )}
      <span className={petTileLabelClass}>
        {item.name}
        {/* 持有數量接在名稱後面（飯糰 ×3），不另外做徽章——跟養成頁那排食物同一個寫法。 */}
        {count > 0 && <span className="tabular-nums"> ×{count}</span>}
      </span>
      <span className={petTileNoteClass}>
        {item.kind === "狀態" && owned
          ? "可在背包勾選"
          : owned && locked
          ? `Lv.${PET_HATCH_LEVEL} 解鎖`
          : equipped
            ? item.kind === "背景"
              ? "使用中"
              : "穿著中"
            : owned
              ? "點擊換上"
              : item.price === 0
                ? "免費"
                : `⭐ ${item.price}`}
      </span>
    </button>
  );
}
