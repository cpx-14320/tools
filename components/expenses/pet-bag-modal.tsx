"use client";

import { Modal } from "./modal";
import { SegmentedControl } from "./button";
import { IconImg } from "./icon-img";
import { PetSprite, type PetStage } from "./pet-sprite";
import { text } from "./theme";
import { PET_ITEMS, petBackground, petItemThumb, type PetItem, type PetItemKind } from "@/lib/expenses/pet";

/** 背包要知道的那幾個欄位——跟商店彈窗同一組，只是這裡不需要 coins（背包不花錢）。 */
export interface BagPetState {
  outfitId: string;
  ownedOutfitIds: string[];
  backgroundId: string;
  ownedBackgroundIds: string[];
}

/** 已經擁有了嗎／正穿著嗎。價格 0 的是預設款，一開始就有。 */
function ownedState(item: PetItem, pet: BagPetState): { owned: boolean; equipped: boolean } {
  if (item.kind === "背景") {
    return { owned: item.price === 0 || pet.ownedBackgroundIds.includes(item.id), equipped: pet.backgroundId === item.id };
  }
  return { owned: item.price === 0 || pet.ownedOutfitIds.includes(item.id), equipped: pet.outfitId === item.id };
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
  stage,
  kind,
  onKindChange,
  onEquip,
}: {
  open: boolean;
  onClose: () => void;
  pet: BagPetState;
  /** 預覽要畫蛋還是角色，由呼叫端依等級決定（見 pet-sprite.ts 的 petStage）。 */
  stage: PetStage;
  /** 現在在看哪一類。頁籤的狀態放在呼叫端：場地下面「衣服」跟「背景」是兩顆不同的
   *  按鈕，各自要打開對應的那一頁，彈窗自己記著的話第二次打開會停在上次那一頁。 */
  kind: Exclude<PetItemKind, "食物">;
  onKindChange: (kind: Exclude<PetItemKind, "食物">) => void;
  onEquip: (itemId: string) => void;
}) {
  const items = PET_ITEMS.filter((i) => i.kind === kind && ownedState(i, pet).owned);

  return (
    <Modal open={open} onClose={onClose} title="背包" fullHeight>
      {/* 預覽跟商店那張一樣是固定高度、角色置中——換裝的結果直接在上面看得到，不用
          關掉彈窗才知道換起來長怎樣。 */}
      <div className="grid h-36 w-full place-items-center rounded-2xl p-3" style={{ background: petBackground(pet.backgroundId) }}>
        <PetSprite stage={stage} mood="idle" outfitId={pet.outfitId} size={96} />
      </div>

      <SegmentedControl
        className="self-start"
        value={kind}
        onChange={onKindChange}
        options={[
          { value: "服裝", label: "服裝" },
          { value: "背景", label: "背景" },
        ]}
      />

      {items.length === 0 ? (
        <p className={text.muted}>背包裡還沒有{kind}，去商店買一件吧。</p>
      ) : (
        /* 一列兩格：縮圖改成正方形之後，三格一列的每一格只剩 100px 出頭，背景圖裁成那麼
           小看不出是哪個房間、服裝也只剩一個小人影。 */
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => {
            const { equipped } = ownedState(item, pet);
            const thumb = petItemThumb(item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => !equipped && onEquip(item.id)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 transition-colors ${
                  equipped ? "border-[#6F5FD6] bg-[#F3EFFC]" : "border-[#ECE4FA] bg-white"
                }`}
              >
                {/* 縮圖固定正方形：服裝那張精靈圖是靠 background-size 700% × 300% 把一格
                    撐成整個框（見 petItemThumb），框本身不是正方形的話那一格就會被拉扁。
                    背景圖則是 9:16，在正方形框裡置中裁切，比例一樣不會變形。 */}
                <span className="relative block w-full">
                  {thumb ? (
                    <span className="block aspect-square w-full rounded-xl border border-[#ECE4FA]" style={{ background: thumb }} />
                  ) : (
                    <IconImg src={item.image} alt={item.name} size={40} />
                  )}
                  {/* 「使用中」釘在縮圖右上角。本來是名字底下固定留一行高（沒在用的就留空），
                      結果每一格的下緣都空著一條，看起來像少畫了一行字。 */}
                  {equipped && (
                    <span className="absolute -right-1 -top-1 rounded-full bg-[#6F5ED4] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                      使用中
                    </span>
                  )}
                </span>
                <span className={`line-clamp-1 w-full text-center text-[11px] ${equipped ? "font-semibold text-[#6F5FD6]" : "text-[#4A3B7C]"}`}>
                  {item.name}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
