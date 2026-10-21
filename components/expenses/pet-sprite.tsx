"use client";

import { useEffect, useState } from "react";

/** 角色圖是一張 4 欄 × 2 列的精靈圖（public/expenses/pet-sprite.png，1536×1024，
 *  每格 384×512）：
 *    第 0 列＝四個方向的站姿（正面／四分之三／側面／背面）
 *    第 1 列＝側面走路循環的四格
 *  要換角色只要換這張圖、維持同樣的格數排法就好。 */
const SPRITE_SRC = "/expenses/pet-sprite.png";
const COLS = 4;
const ROWS = 2;

/** 走路循環每一格停留多久（毫秒）。四格一輪約半秒，是這種 Q 版角色看起來最自然的節奏。 */
const WALK_FRAME_MS = 130;

/** 角色在場地裡走到哪（0＝最左，1＝最右），每一步前進多少。 */
const WALK_STEP = 0.012;

/** 背景位置：第 col 欄、第 row 列。N 欄的話每一欄落在 col/(N-1) 的百分比上。 */
function framePosition(col: number, row: number): string {
  return `${(col / (COLS - 1)) * 100}% ${(row / (ROWS - 1)) * 100}%`;
}

export type PetMood = "idle" | "walking";

/**
 * 會呼吸、會眨眼、會走來走去的角色。
 *
 * 走路是「精靈圖換格 + translateX 位移」自己算的，不是 CSS scroll/animation 套件：
 * 四格走路圖依序換，同時整個角色往左或往右移動，碰到場地邊緣就轉向（水平鏡像，不用
 * 另外畫一組反方向的圖）。待機時用純 CSS 的上下浮動當呼吸，不需要額外的圖。
 *
 * 眨眼目前沒有對應的圖（精靈圖裡沒有閉眼那一格），所以先不做——要做的話補一格閉眼的
 * 站姿，在這裡每隔幾秒切過去 150ms 就好。
 */
export function PetSprite({ mood = "idle", hueRotate = 0, size = 160 }: { mood?: PetMood; hueRotate?: number; size?: number }) {
  const [frame, setFrame] = useState(0);
  // 位置跟方向放在同一份狀態裡，一次更新完：方向會影響畫面（往右走要鏡像），所以不能
  // 放在 ref 裡；兩個分開存又會讓「走到邊緣要轉向」要跨兩個 updater 才算得出來。
  // dir：1＝往右走，-1＝往左走。精靈圖裡的走路是面向左邊，所以往右走時要水平鏡像。
  const [walk, setWalk] = useState({ x: 0.5, dir: 1 });

  useEffect(() => {
    // 停下來時不用把 frame 歸零——待機本來就改用站姿那一格（見下面的 backgroundPosition），
    // 留著上次走到哪一格，下次開始走才會接著動、不會每次都從同一腳開始。
    if (mood !== "walking") return;
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % COLS);
      setWalk((prev) => {
        const next = prev.x + WALK_STEP * prev.dir;
        // 碰到場地邊緣就轉身往回走。
        if (next >= 1) return { x: 1, dir: -1 };
        if (next <= 0) return { x: 0, dir: 1 };
        return { x: next, dir: prev.dir };
      });
    }, WALK_FRAME_MS);
    return () => clearInterval(timer);
  }, [mood]);

  const walking = mood === "walking";
  const facingRight = walk.dir === 1;

  return (
    <div className="relative w-full overflow-hidden" style={{ height: size }}>
      <div
        className="absolute bottom-0"
        style={{
          // left 用百分比在場地裡移動，translateX(-50%) 讓 x 代表角色的中心點。
          left: `${walk.x * 100}%`,
          transform: `translateX(-50%)`,
          transition: walking ? `left ${WALK_FRAME_MS}ms linear` : undefined,
        }}
      >
        <div
          className={walking ? "" : "animate-[petBreathe_2.4s_ease-in-out_infinite]"}
          style={{
            width: size * 0.75,
            height: size,
            backgroundImage: `url("${SPRITE_SRC}")`,
            backgroundSize: `${COLS * 100}% ${ROWS * 100}%`,
            backgroundPosition: walking ? framePosition(frame, 1) : framePosition(0, 0),
            backgroundRepeat: "no-repeat",
            // 走路圖本身面向左邊，往右走時整個鏡像過來，不用另外畫一組。
            // hue-rotate 是「換裝」的暫代做法——還沒有各套服裝的圖，先用色相旋轉讓
            // 使用者看得出換了衣服，之後補上真的服裝圖再換掉這一行。
            transform: walking && facingRight ? "scaleX(-1)" : undefined,
            filter: hueRotate ? `hue-rotate(${hueRotate}deg)` : undefined,
          }}
        />
      </div>
    </div>
  );
}
