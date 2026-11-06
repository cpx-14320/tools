"use client";

import { useEffect, useState } from "react";

import { SPRITE_COLS, SPRITE_ROWS, petOutfitSprite } from "@/lib/expenses/pet";

/** 角色有兩個階段：
 *    Lv.1～9   → egg-state.png／egg-eating.png（還沒孵化的蛋）
 *    Lv.10 以上 → 身上那套造型的 intj-model-<造型>-idle.png／共用的 intj-eating.png
 *
 *  孵出來以後「待機」播的是服裝那張圖（見 lib/expenses/pet.ts 的 petOutfitSprite），
 *  換裝＝換那張精靈圖，不再是色相旋轉。吃東西目前只有一張共用的 intj-eating.png，
 *  所以餵食那一輪看到的會是預設造型——等每套造型都有自己的 eating 圖再比照 idle 改。
 *
 *  所有圖的排法都一樣：7 欄 × 3 列＝21 格，從左上往右、再換下一列，接成一輪連續的
 *  動畫（待機是呼吸＋眨眼，吃東西是把食物吃完的一輪）。要換角色只要換圖、維持同樣的
 *  格數排法就好。
 *
 *  intj-model-* 是照規格出的新圖（3500×1500，一格 500×500、角色都在格子裡），百分比
 *  定位剛好整除。舊的 egg-*／intj-eating 還是 1916×821，一格 273.7px 會有次像素誤差，
 *  intj-eating 第 1、2 列的角色也比格子高、上緣會透出上一列的腳——那是圖本身的問題，
 *  CSS 這邊無解（backgroundSize 700% 300% 的意思就是「一格正好等於這個元素」，隔壁格
 *  溢出來的部分一定落在框內），要重出圖才解得掉，規格照 intj-model-* 那樣就對了。 */
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

/** 從第幾級開始從蛋變成角色。 */
export const PET_HATCH_LEVEL = 10;

export type PetStage = "egg" | "intj";
export type PetMood = "idle" | "eating";

/** 等級決定現在要畫蛋還是角色。 */
export function petStage(level: number): PetStage {
  return level >= PET_HATCH_LEVEL ? "intj" : "egg";
}

/** 不隨造型改變的那幾張：蛋的兩張、還有孵化後共用的吃東西。孵化後的待機由呼叫端
 *  傳進來的 outfitId 決定。 */
const SHEETS = {
  egg: { idle: "/expenses/egg-state.png", eating: "/expenses/egg-eating.png" },
  intj: { eating: "/expenses/intj-eating.png" },
} as const;

function sheetFor(stage: PetStage, mood: PetMood, outfitId: string): string {
  if (stage === "egg") return SHEETS.egg[mood];
  return mood === "eating" ? SHEETS.intj.eating : petOutfitSprite(outfitId);
}

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
  stage,
  mood = "idle",
  /** 身上那套造型（服裝的 item id）——決定孵化後待機要播哪張精靈圖。 */
  outfitId = "",
  /** 角色要畫多大（正方形，單位 px）。格子本身就是正方形，所以寬高同一個數字。 */
  size = 180,
}: {
  stage: PetStage;
  mood?: PetMood;
  outfitId?: string;
  size?: number;
}) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    // 換圖（待機↔吃東西、蛋↔角色）時從頭播：接在上一張的第 13 格會看起來像跳格。
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setFrame(0);
    const timer = setInterval(() => setFrame((f) => (f + 1) % FRAMES), FRAME_MS);
    return () => clearInterval(timer);
  }, [mood, stage, outfitId]);

  return (
    // 外層把角色置中在呼叫端給的場地裡；角色本身是固定尺寸，不跟著場地縮放。
    <div className="grid size-full place-items-center">
      <div
        style={{
          width: size,
          height: size,
          backgroundImage: `url("${sheetFor(stage, mood, outfitId)}")`,
          backgroundSize: `${COLS * 100}% ${ROWS * 100}%`,
          backgroundPosition: framePosition(frame % COLS, Math.floor(frame / COLS)),
          backgroundRepeat: "no-repeat",
        }}
      />
    </div>
  );
}
