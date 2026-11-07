"use client";

import { useEffect, useState } from "react";

import { SPRITE_COLS, SPRITE_ROWS, petOutfitSprite } from "@/lib/expenses/pet";

/** 角色長什麼樣子完全由「身上那套造型」決定（見 lib/expenses/pet.ts 的 petOutfitSprite）：
 *    outfit-egg → egg-state.png／egg-eating.png（還沒孵化的蛋，也是出生造型）
 *    其他造型   → intj-model-<造型>-idle.png／共用的 intj-eating.png
 *
 *  本來是「等級決定畫蛋還是畫角色」（petStage），現在蛋自己也是背包裡可以挑的一套造型，
 *  孵化後想換回蛋也行，所以這裡不再看等級——該不該退回蛋是 effectiveOutfitId 的事，
 *  呼叫端傳進來的已經是算好的結果。
 *
 *  吃東西目前只有蛋自己一張、孵化後的造型共用一張 intj-eating.png，所以餵食那一輪
 *  看到的會是預設造型——等每套造型都有自己的 eating 圖，在 PET_ITEMS 補 eating 欄位即可。
 *
 *  所有圖的排法都一樣：7 欄 × 3 列＝21 格，從左上往右、再換下一列，接成一輪連續的
 *  動畫（待機是呼吸＋眨眼，吃東西是把食物吃完的一輪）。要換角色只要換圖、維持同樣的
 *  格數排法就好。
 *
 *  egg-state 跟 intj-model-* 都是照規格出的圖（3500×1500，一格 500×500、角色都在格子
 *  裡），百分比定位剛好整除。還沒重出的 egg-eating／intj-eating 仍是 1916×821，一格
 *  273.7px 會有次像素誤差，intj-eating 第 1、2 列的角色也比格子高、上緣會透出上一列的
 *  腳——那是圖本身的問題，CSS 這邊無解（backgroundSize 700% 300% 的意思就是「一格正好
 *  等於這個元素」，隔壁格溢出來的部分一定落在框內），要重出圖才解得掉。 */
// 格數跟 lib/expenses/pet.ts 共用一組常數：商店裁服裝縮圖的第一格也要用到同樣的數字，
// 兩邊各寫一次遲早會對不上。
const COLS = SPRITE_COLS;
const ROWS = SPRITE_ROWS;
const FRAMES = COLS * ROWS;

/** 每一格停留多久（毫秒）。21 格約 3 秒跑完一輪——原本 90ms（1.9 秒一輪）看起來像在
 *  發抖，待機的呼吸本來就該慢。 */
const FRAME_MS = 140;

/** 吃東西的動畫跑完一輪要多久——餵食後呼叫端用這個時間把心情切回 idle。 */
export const PET_EATING_MS = FRAMES * FRAME_MS;

export type PetMood = "idle" | "eating";

/** 背景位置：第 col 欄、第 row 列。N 欄的話每一欄落在 col/(N-1) 的百分比上。 */
function framePosition(col: number, row: number): string {
  return `${(col / (COLS - 1)) * 100}% ${(row / (ROWS - 1)) * 100}%`;
}

/**
 * 會呼吸、吃東西的角色。
 *
 * 動畫是「精靈圖換格」自己算的，不是 CSS animation：21 格依序換，跑完回到第一格。
 * 待機跟吃東西用的是兩張不同的圖、同一套換格邏輯，切換心情時從第 0 格重新開始，
 * 吃東西才會從「還沒咬」那一格演起。
 *
 * 不再有「散步」：那需要一組側面走路圖，現在的圖都是正面定點的動畫。原本的
 * translateX 位移、碰邊轉身、水平鏡像也跟著拿掉了。
 */
export function PetSprite({
  mood = "idle",
  /** 身上那套造型（服裝的 item id）——決定要播哪張精靈圖。等級不夠時請先用
   *  effectiveOutfitId 換算成蛋再傳進來。 */
  outfitId = "",
  /** 角色要畫多大（正方形，單位 px）。格子本身就是正方形，所以寬高同一個數字。 */
  size = 180,
}: {
  mood?: PetMood;
  outfitId?: string;
  size?: number;
}) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    // 換圖（待機↔吃東西、換造型）時從頭播：接在上一張的第 13 格會看起來像跳格。
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setFrame(0);
    const timer = setInterval(() => setFrame((f) => (f + 1) % FRAMES), FRAME_MS);
    return () => clearInterval(timer);
  }, [mood, outfitId]);

  return (
    // 外層把角色置中在呼叫端給的場地裡；角色本身是固定尺寸，不跟著場地縮放。
    <div className="grid size-full place-items-center">
      <div
        style={{
          width: size,
          height: size,
          backgroundImage: `url("${petOutfitSprite(outfitId, mood)}")`,
          backgroundSize: `${COLS * 100}% ${ROWS * 100}%`,
          backgroundPosition: framePosition(frame % COLS, Math.floor(frame / COLS)),
          backgroundRepeat: "no-repeat",
        }}
      />
    </div>
  );
}
