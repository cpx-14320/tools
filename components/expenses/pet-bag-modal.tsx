"use client";

import { useEffect, useState } from "react";

import { PetModal } from "./pet-modal";
import { PetTabs, petThumbClass, petTileClass, petTileLabelClass } from "./pet-ui";
import { IconImg } from "./icon-img";
import { PetSprite, PET_ANIMATION_MS, type PetMood } from "./pet-sprite";
import { PET_ITEMS, PET_HATCH_LEVEL, effectiveOutfitId, outfitUnlocked, petBackground, petItemThumb, type PetItem, type PetItemKind } from "@/lib/expenses/pet";

/** 背包要知道的那幾個欄位——跟商店彈窗同一組，只是這裡不需要 coins（背包不花錢）。 */
export interface BagPetState {
  outfitId: string;
  ownedOutfitIds: string[];
  backgroundId: string;
  ownedBackgroundIds: string[];
  /** 已經買到的動作狀態／目前勾起來的那幾個（狀態是複選的）。 */
  ownedStateIds: string[];
  activeStateIds: string[];
}

/** 已經擁有了嗎／正穿著嗎。價格 0 的是預設款，一開始就有。
 *
 *  服裝比的是 currentOutfit（已經過 effectiveOutfitId 換算）而不是資料裡那一筆：等級不夠
 *  時畫面上畫的是蛋，這裡要跟著標蛋為「使用中」，不然會出現「標著使用中的那件，角色
 *  身上卻沒穿」。 */
function ownedState(item: PetItem, pet: BagPetState, currentOutfit: string): { owned: boolean; equipped: boolean } {
  if (item.kind === "背景") {
    return { owned: item.price === 0 || pet.ownedBackgroundIds.includes(item.id), equipped: pet.backgroundId === item.id };
  }
  // 狀態分兩種：動作狀態要買、而且可以同時勾很多個（勾起來的標「使用中」）；孵化那種
  // 紀念狀態不用買、也不能勾，點了只是在預覽區重播一次。
  if (item.kind === "狀態") {
    return item.action
      ? { owned: pet.ownedStateIds.includes(item.id), equipped: pet.activeStateIds.includes(item.id) }
      : { owned: true, equipped: false };
  }
  return { owned: item.price === 0 || pet.ownedOutfitIds.includes(item.id), equipped: currentOutfit === item.id };
}

/** 背包——換已經買過的服裝／背景。
 *
 *  跟商店分開是刻意的：商店只負責「花星星幣買新的」，背包只負責「換已經有的」。本來兩件
 *  事都塞在商店裡，結果同一個格子點下去有時候是扣錢、有時候是換裝，差別只在這件有沒有
 *  買過——那是使用者記不住、而且猜錯會花掉星星幣的規則。拆開之後商店裡的每一格一定是
 *  花錢、背包裡的每一格一定是免費。
 *
 *  背包裡不放食物：食物是「點了就吃掉」的消耗品，放在養成頁上那排固定的圖示直接點更快，
 *  不用先開彈窗。 */
export function PetBagModal({
  open,
  onClose,
  pet,
  level,
  kind,
  onKindChange,
  onEquip,
  onToggleState,
}: {
  open: boolean;
  onClose: () => void;
  pet: BagPetState;
  /** 目前等級——決定哪幾套造型穿得上（孵化前只有蛋可以穿）。 */
  level: number;
  /** 現在在看哪一類。頁籤的狀態放在呼叫端：場地下面「衣服」跟「背景」是兩顆不同的
   *  按鈕，各自要打開對應的那一頁，彈窗自己記著的話第二次打開會停在上次那一頁。 */
  kind: Exclude<PetItemKind, "食物">;
  onKindChange: (kind: Exclude<PetItemKind, "食物">) => void;
  onEquip: (itemId: string) => void;
  /** 勾起／取消勾選一個動作狀態。 */
  onToggleState: (itemId: string) => void;
}) {
  const currentOutfit = effectiveOutfitId(pet.outfitId, level);
  const items = PET_ITEMS.filter((i) => i.kind === kind && ownedState(i, pet, currentOutfit).owned);

  // 預覽區的動畫：平常是待機，點了「狀態」裡的孵化就在這裡重播一次再回到待機。
  const [mood, setMood] = useState<PetMood>("idle");
  useEffect(() => {
    if (mood === "idle") return;
    const timer = setTimeout(() => setMood("idle"), PET_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [mood]);

  return (
    <PetModal open={open} onClose={onClose} title="背包">
      {/* 預覽：16:9 的橫幅，角色 160px 置中——換裝、換背景的結果直接在上面看得到，不用
          關掉彈窗才知道換起來長怎樣。背景圖本身是 9:16 的直式房間圖，在這個扁框裡只看得到
          其中一條；裁切位置往上挪到 42%（不是置中）——置中會切在地板那一段，往上一點才
          帶到房間的陳設，角色也不會看起來像站在一片空地上。 */}
      <div
        className="grid aspect-[16/9] w-full place-items-center rounded-2xl border-2 border-[#E3D4F5] p-2"
        style={{ background: petBackground(pet.backgroundId, "center 42%") }}
      >
        <PetSprite mood={mood} outfitId={currentOutfit} size={160} />
      </div>

      <PetTabs
        value={kind}
        onChange={onKindChange}
        options={[
          { value: "服裝", label: "服裝" },
          { value: "背景", label: "背景" },
          { value: "狀態", label: "狀態" },
        ]}
      />

      {items.length === 0 ? (
        <p className="text-center text-xs text-[#9C7FC0]">背包裡還沒有{kind}，去商店買一件吧。</p>
      ) : (
        /* 一列兩格：縮圖改成正方形之後，三格一列的每一格只剩 100px 出頭，背景圖裁成那麼
           小看不出是哪個房間、服裝也只剩一個小人影。 */
        <div className="grid grid-cols-2 gap-2">
          {items.map((item) => {
            const { equipped } = ownedState(item, pet, currentOutfit);
            const thumb = petItemThumb(item);
            // 等級不夠的造型／狀態留在格子裡但點不動——藏起來的話使用者會以為自己買的
            // 東西不見了，而且「有這個東西、只是還沒到等級」本身就是想讓人看到的資訊。
            const locked = item.kind !== "背景" && !outfitUnlocked(item, level);
            return (
              <button
                key={item.id}
                type="button"
                // 狀態不是換上去的東西，點了只是在上面的預覽區重播一次那段動畫。
                onClick={() => {
                  if (locked) return;
                  // 動作狀態是複選：點一下勾起來、再點一下取消（所以已經「使用中」的也能點）。
                  // 孵化那種紀念狀態不能勾，點了只是在上面的預覽區重播一次。
                  if (item.kind === "狀態") {
                    if (item.action) onToggleState(item.id);
                    else setMood("hatching");
                  } else if (!equipped) {
                    onEquip(item.id);
                  }
                }}
                disabled={locked}
                className={petTileClass({ selected: equipped, locked })}
              >
                {/* 縮圖固定正方形：服裝那張精靈圖是靠 background-size 700% × 300% 把一格
                    撐成整個框（見 petItemThumb），框本身不是正方形的話那一格就會被拉扁。
                    背景圖則是 9:16，在正方形框裡置中裁切，比例一樣不會變形。 */}
                <span className="relative block w-full">
                  {thumb ? (
                    <span className={`block ${petThumbClass}`} style={{ background: thumb }} />
                  ) : (
                    <IconImg src={item.image} alt={item.name} size={40} />
                  )}
                  {/* 「使用中」壓在縮圖右上角、往內縮一點。本來是名字底下固定留一行高
                      （沒在用的就留空），結果每一格的下緣都空著一條；之後改成貼著角落
                      又剛好卡在圖片跟外框的交界上，一半在圖上一半在白邊上。 */}
                  {equipped && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-[#9B7BD6] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                      使用中
                    </span>
                  )}
                  {/* 還沒孵化就買好的造型：標出要幾級才穿得上，不是只有一顆按不動的格子。 */}
                  {locked && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-[#5B3B8C]/75 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                      Lv.{PET_HATCH_LEVEL}
                    </span>
                  )}
                </span>
                <span className={petTileLabelClass}>{item.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </PetModal>
  );
}
