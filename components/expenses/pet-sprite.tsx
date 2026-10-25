"use client";

import { useEffect, useState } from "react";

/** 角色圖是一張 8 欄 × 4 列的精靈圖（public/expenses/pet-sprite.png，1239×657，
 *  每格 154.875×164.25）：
 *    第 0 列＝正面，8 格
 *    第 1～2 列＝側面（面向左）走路循環，兩列接起來是連續的 16 格
 *    第 3 列＝背面，8 格
 *  要換角色只要換這張圖、維持同樣的格數排法就好。
 *
 *  圖的長寬不是格數的整數倍（1239/8＝154.875），但每一格的角色都完整落在自己那一格的
 *  範圍內（確認過沒有任何一格的圖溢出到隔壁），所以用百分比定位不會切到隔壁的角色。 */
const SPRITE_SRC = "/expenses/pet-sprite.png";
const SHEET_W = 1239;
const SHEET_H = 657;
const COLS = 8;
const ROWS = 4;

/** 一格的長寬比，給外層算寬度用——寫死 3/4 的話換圖就會被拉扁。 */
const CELL_ASPECT = `${SHEET_W / COLS} / ${SHEET_H / ROWS}`;

/** 走路循環用第 1～2 列接成一輪，共 16 格。 */
const WALK_ROW_START = 1;
const WALK_FRAMES = COLS * 2;

/** 走路循環每一格停留多久（毫秒）。16 格一輪約 1 秒，跟原本 4 格 ×130ms 的節奏一樣快，
 *  只是中間的過渡格變多、動作更順。 */
const WALK_FRAME_MS = 65;

/** 角色在場地裡走到哪（0＝最左，1＝最右），每一步前進多少。格數變兩倍、每格的時間變
 *  一半，所以每一步的距離也要減半，走路速度才跟原本一樣。 */
const WALK_STEP = 0.006;

/** 背景位置：第 col 欄、第 row 列。N 欄的話每一欄落在 col/(N-1) 的百分比上。 */
function framePosition(col: number, row: number): string {
  return `${(col / (COLS - 1)) * 100}% ${(row / (ROWS - 1)) * 100}%`;
}

export type PetMood = "idle" | "walking";

/**
 * 會呼吸、會眨眼、會走來走去的角色。
 *
 * 走路是「精靈圖換格 + translateX 位移」自己算的，不是 CSS scroll/animation 套件：
 * 16 格走路圖依序換，同時整個角色往左或往右移動，碰到場地邊緣就轉向（水平鏡像，不用
 * 另外畫一組反方向的圖）。待機時用純 CSS 的上下浮動當呼吸，不需要額外的圖。
 *
 * 精靈圖第 3 列的背面目前沒用到——要做「走遠／回家」那種往畫面深處走的效果時再接上。
 */
export function PetSprite({ mood = "idle", hueRotate = 0, heightPct = 76 }: { mood?: PetMood; hueRotate?: number; heightPct?: number }) {
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
      setFrame((f) => (f + 1) % WALK_FRAMES);
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
    // 高寬都交給外層決定（呼叫端用 aspect-square 之類的給一個方形場地），這裡只負責填滿。
    <div className="relative size-full overflow-hidden">
      <div
        className="absolute bottom-0"
        style={{
          // 高度跟著場地走，寬度由長寬比推出來——寬度也用百分比的話，場地不是正方形時
          // 角色會被拉扁。尺寸掛在這一層（定位用的那層）而不是裡面那層：百分比高度要有
          // 一個高度確定的父層才算得出來，而絕對定位的這層本身是由內容撐開的。
          height: `${heightPct}%`,
          aspectRatio: CELL_ASPECT,
          // x=0 貼左邊、x=1 貼右邊，兩端都還是完整的角色：位置用場地寬度的百分比，位移則用
          // 角色「自己」寬度的百分比（translateX 的 % 是算自己的寬度），兩者相抵之後就不需要
          // 知道角色實際幾 px——x=0 時不位移、x=1 時剛好往回退一個自己的寬度。
          left: `${walk.x * 100}%`,
          transform: `translateX(${-walk.x * 100}%)`,
          transition: walking ? `left ${WALK_FRAME_MS}ms linear` : undefined,
          // 這裡原本掛著 mixBlendMode: "multiply"，是因為舊的角色圖是白底、不是去背的
          // PNG，要靠白色乘上底色＝等於消失，才不會看到一個白色方塊。現在這張已經去背
          // （確認過整張圖的背景 alpha 是 0），再 multiply 只會讓角色自己的顏色跟底色
          // 相乘、整個變暗，所以拿掉。
        }}
      >
        <div
          className={`size-full ${walking ? "" : "animate-[petBreathe_2.4s_ease-in-out_infinite]"}`}
          style={{
            backgroundImage: `url("${SPRITE_SRC}")`,
            backgroundSize: `${COLS * 100}% ${ROWS * 100}%`,
            // 走路的 16 格橫跨第 1、2 兩列，所以列號要跟著 frame 走；待機用第 0 列
            // （正面）的第一格，呼吸交給上面那段 CSS 浮動。
            backgroundPosition: walking
              ? framePosition(frame % COLS, WALK_ROW_START + Math.floor(frame / COLS))
              : framePosition(0, 0),
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
