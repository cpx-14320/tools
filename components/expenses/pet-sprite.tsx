"use client";

import { useEffect, useState } from "react";

/** 角色有兩個階段，各自一張「待機」跟一張「吃東西」的精靈圖：
 *    Lv.1～9   → egg-state.png／egg-eating.png（還沒孵化的蛋）
 *    Lv.10 以上 → intj-state.png／intj-eating.png（孵出來的角色）
 *
 *  四張圖的排法都一樣：7 欄 × 3 列＝21 格，從左上往右、再換下一列，接成一輪連續的
 *  動畫（待機是呼吸＋眨眼，吃東西是把食物吃完的一輪）。要換角色只要換圖、維持同樣的
 *  格數排法就好。
 *
 *  ⚠ 目前的圖有兩個問題，要重新出圖才解得掉：
 *  1. 長寬不是格數的整數倍（egg 1916×821、intj 1915×821，一格 273.7×273.7），百分比
 *     定位會有次像素誤差。
 *  2. intj-state 第 1、2 列的角色「比格子高」——上下邊界的留白量測出來是 0，所以畫某一
 *     格時會從上緣透出上一列角色的腳。這是圖本身的問題，CSS 這邊無解：backgroundSize
 *     700% 300% 的意思就是「一格正好等於這個元素」，隔壁格溢出來的部分一定落在框內。
 *  出新圖的規格：7 欄 × 3 列、一格 320×320（整張 2240×960），角色置中且四邊至少留 24px
 *  空白、整張背景全透明不要留格線。 */
const COLS = 7;
const ROWS = 3;
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

const SHEETS: Record<PetStage, Record<PetMood, string>> = {
  egg: { idle: "/expenses/egg-state.png", eating: "/expenses/egg-eating.png" },
  intj: { idle: "/expenses/intj-state.png", eating: "/expenses/intj-eating.png" },
};

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
 * 不再有「散步」：那需要一組側面走路圖，現在的四張圖都是正面定點的動畫。原本的
 * translateX 位移、碰邊轉身、水平鏡像也跟著拿掉了。
 */
export function PetSprite({
  stage,
  mood = "idle",
  hueRotate = 0,
  /** 角色要畫多大（正方形，單位 px）。格子本身就接近正方形，所以寬高同一個數字。 */
  size = 110,
}: {
  stage: PetStage;
  mood?: PetMood;
  hueRotate?: number;
  size?: number;
}) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    // 換圖（待機↔吃東西、蛋↔角色）時從頭播：接在上一張的第 13 格會看起來像跳格。
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setFrame(0);
    const timer = setInterval(() => setFrame((f) => (f + 1) % FRAMES), FRAME_MS);
    return () => clearInterval(timer);
  }, [mood, stage]);

  return (
    // 外層把角色置中在呼叫端給的場地裡；角色本身是固定尺寸，不跟著場地縮放。
    <div className="grid size-full place-items-center">
      <div
        style={{
          width: size,
          height: size,
          backgroundImage: `url("${SHEETS[stage][mood]}")`,
          backgroundSize: `${COLS * 100}% ${ROWS * 100}%`,
          backgroundPosition: framePosition(frame % COLS, Math.floor(frame / COLS)),
          backgroundRepeat: "no-repeat",
          // hue-rotate 是「換裝」的暫代做法——還沒有各套服裝的圖，先用色相旋轉讓
          // 使用者看得出換了衣服，之後補上真的服裝圖再換掉這一行。
          filter: hueRotate ? `hue-rotate(${hueRotate}deg)` : undefined,
        }}
      />
    </div>
  );
}
