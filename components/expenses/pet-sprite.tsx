"use client";

import { useEffect, useState } from "react";

import { FOOD_EATING_SPRITES, FOOD_SPRITE_COLS, FOOD_SPRITE_LOOPS, SPRITE_COLS, SPRITE_ROWS, petItemById, petOutfitSprite } from "@/lib/expenses/pet";

/** 角色長什麼樣子完全由「身上那套造型」決定（見 lib/expenses/pet.ts 的 petOutfitSprite）：
 *    outfit-egg → egg-state.png／egg-eating.png（還沒孵化的蛋，也是出生造型）
 *    其他造型   → intj-model-<造型>-idle.png／吃東西時維持同一張（待機姿勢不動）
 *
 *  本來是「等級決定畫蛋還是畫角色」（petStage），現在蛋自己也是背包裡可以挑的一套造型，
 *  孵化後想換回蛋也行，所以這裡不再看等級——該不該退回蛋是 effectiveOutfitId 的事，
 *  呼叫端傳進來的已經是算好的結果。
 *
 *  孵化後的造型沒有自己的「吃東西」姿勢（以前共用一張 intj-eating.png，那張圖已經
 *  淘汰、不再使用），所以吃一份**沒有專屬動畫的食物**時維持待機姿勢。真正的「吃東西」
 *  畫面來自食物本身的專屬動畫（見下面 FOOD_EATING_SPRITES 那一段），不是靠角色這邊
 *  演一輪「吃完」的動作——造型只負責「角色長什麼樣子站在那裡」，食物消失的那個動畫
 *  是另外疊上去的一張單列圖。
 *
 *  所有造型圖的排法都一樣：7 欄 × 3 列＝21 格，從左上往右、再換下一列，接成一輪連續的
 *  動畫（待機是呼吸＋眨眼）。要換角色只要換圖、維持同樣的格數排法就好。
 *
 *  egg-state 跟 intj-model-* 都是照規格出的圖（3500×1500，一格 500×500、角色都在格子
 *  裡），百分比定位剛好整除。還沒重出的 egg-eating 仍是 1916×821，一格 273.7px 會有
 *  次像素誤差——那是圖本身的問題，CSS 這邊無解，要重出圖才解得掉。 */
// 格數跟 lib/expenses/pet.ts 共用一組常數：商店裁服裝縮圖的第一格也要用到同樣的數字，
// 兩邊各寫一次遲早會對不上。
const COLS = SPRITE_COLS;
const ROWS = SPRITE_ROWS;
const FRAMES = COLS * ROWS;

/** 每一格停留多久（毫秒）。21 格約 3 秒跑完一輪——原本 90ms（1.9 秒一輪）看起來像在
 *  發抖，待機的呼吸本來就該慢。 */
const FRAME_MS = 140;

/** 一輪動畫（21 格）要多久。吃東西、孵化、動作狀態都是「演一次就回到待機」，長度一樣
 *  ——它們用的是同一套格數跟同一個換格速度，所以共用這一個常數，呼叫端拿它當計時器。 */
export const PET_ANIMATION_MS = FRAMES * FRAME_MS;

/** 食物動畫每一格停留多久——跟角色那套（FRAME_MS）分開放，因為食物這邊**刻意放慢**：
 *  原本兩邊共用 140ms，一塊蛋糕兩輪 14 格咬完只要 1.96 秒，一眨眼就沒了，看不清楚
 *  到底在吃什麼。放到 240ms 之後一輪（兩次咬完）要 3.36 秒，咬一口、停一下、再咬
 *  一口的節奏才看得出來。 */
const FOOD_FRAME_MS = 240;

/** 食物專屬動畫（單列 7 格、演兩輪）要多久。 */
const FOOD_ANIMATION_MS = FOOD_SPRITE_COLS * FOOD_SPRITE_LOOPS * FOOD_FRAME_MS;

/** 食物畫在角色旁邊的大小與位置，都是「佔角色幾成」的比例（乘上角色的 size）。
 *  用比例不用固定 px：場地上的角色是 180px、背包預覽是 130px，比例寫一次兩邊都對。
 *
 *  FOOD_LEFT／FOOD_TOP 量的是食物左上角落在角色那個正方形框的幾成處。角色在自己的
 *  500×500 格子裡是置中偏上、腳底大約在七成高的位置，所以食物擺在「右邊 0.58、
 *  上緣 0.42」時盤子剛好落在腳邊的地面上，不會浮在半空也不會疊到角色身上。 */
const FOOD_SCALE = 0.46;
const FOOD_LEFT = 0.58;
const FOOD_TOP = 0.42;

/** 餵食那一輪要演多久（呼叫端拿它設定「演完切回待機」的計時器）。
 *
 *  角色跟食物是**兩段各自獨立的動畫**，速度也不一樣（角色 140ms／格、食物放慢成
 *  240ms／格，見 FOOD_FRAME_MS），所以取兩者比較長的那一個：太短會把還在動的那一邊
 *  切掉，太長會讓先演完的那一邊乾等。
 *  - 有專屬動畫的食物：食物那段（3,360ms）比角色的吃東西／待機動畫都長，以它為準；
 *    角色（蛋的話）會先演完自己那輪再維持最後一格，食物演完定格在空盤（FoodBite
 *    不繞回第一格），兩個一起等到這一輪真的結束。
 *  - 吃還沒畫動畫的食物：沒有東西要等，照角色通用長度走就好。 */
export function petEatingDurationMs(foodId: string | undefined, outfitId: string): number {
  const foodMs = foodId && FOOD_EATING_SPRITES[foodId] ? FOOD_ANIMATION_MS : 0;
  const characterMs = petItemById(outfitId)?.eating ? PET_ANIMATION_MS : 0;
  return Math.max(foodMs, characterMs) || PET_ANIMATION_MS;
}

/** hatching 是「演一次就結束」的那段孵化動畫，不像 idle 會一直循環——呼叫端自己在
 *  PET_HATCHING_MS 之後把心情切回 idle（見 pet-view.tsx）。 */
export type PetMood = "idle" | "eating" | "hatching" | "action";

/** 背景位置：cols 欄、rows 列的精靈圖裡，第 col 欄、第 row 列那一格。N 欄（列）的話
 *  每一欄（列）落在 col/(N-1)（row/(N-1)）的百分比上；只有一列時除式會是 0/0，
 *  這時固定回傳 0% 避免算出 NaN。 */
function framePosition(cols: number, rows: number, col: number, row: number): string {
  const x = cols > 1 ? (col / (cols - 1)) * 100 : 0;
  const y = rows > 1 ? (row / (rows - 1)) * 100 : 0;
  return `${x}% ${y}%`;
}

/**
 * 會呼吸、吃東西的角色。
 *
 * 動畫是「精靈圖換格」自己算的，不是 CSS animation：21 格依序換，跑完回到第一格。
 * 蛋的待機跟吃東西是兩張不同的圖（egg-state／egg-eating）；孵化後的造型沒有專屬的
 * 吃東西圖，吃一份沒有專屬動畫的食物時跟待機是同一張圖，只是重新從第 0 格播起。
 *
 * 不再有「散步」：那需要一組側面走路圖，現在的圖都是正面定點的動畫。原本的
 * translateX 位移、碰邊轉身、水平鏡像也跟著拿掉了。
 */
export function PetSprite({
  mood = "idle",
  /** mood 是 "action" 時要播的那張精靈圖（動作狀態的圖）。其他心情用不到——那幾張是
   *  由身上的造型決定的。 */
  actionSprite,
  /** 身上那套造型（服裝的 item id）——決定要播哪張精靈圖。等級不夠時請先用
   *  effectiveOutfitId 換算成蛋再傳進來。 */
  outfitId = "",
  /** mood 是 "eating" 時正在吃的那個食物 item id。有專屬動畫的食物（見
   *  FOOD_EATING_SPRITES）會改播那張單列短循環的圖，沒有的維持造型待機姿勢不動。 */
  foodId,
  /** 角色要畫多大（正方形，單位 px）。格子本身就是正方形，所以寬高同一個數字。 */
  size = 180,
}: {
  mood?: PetMood;
  actionSprite?: string;
  outfitId?: string;
  foodId?: string;
  size?: number;
}) {
  const [frame, setFrame] = useState(0);

  // 這一口有沒有專屬的食物動畫。它畫的是**食物本身**（一塊蛋糕一口一口被吃到只剩
  // 空盤），不是角色，所以不會取代角色那張圖——角色照常站在原地（蛋就播蛋自己的
  // 吃東西動畫），食物另外畫在他旁邊，合起來才像「角色正在吃這份東西」。
  const foodSprite = mood === "eating" ? FOOD_EATING_SPRITES[foodId ?? ""] : undefined;
  const src = mood === "action" && actionSprite ? actionSprite : petOutfitSprite(outfitId, mood === "action" ? "idle" : mood);

  useEffect(() => {
    // 換圖（待機↔吃東西、換造型）時從頭播：接在上一張的第 13 格會看起來像跳格。
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setFrame(0);
    const timer = setInterval(() => setFrame((f) => (f + 1) % FRAMES), FRAME_MS);
    return () => clearInterval(timer);
  }, [mood, outfitId, actionSprite]);

  return (
    // 外層把角色置中在呼叫端給的場地裡；角色本身是固定尺寸，不跟著場地縮放。
    // relative：食物動畫要貼著角色擺（絕對定位），定位基準就是這一格。
    <div className="relative grid size-full place-items-center">
      <div
        style={{
          width: size,
          height: size,
          backgroundImage: `url("${src}")`,
          backgroundSize: `${COLS * 100}% ${ROWS * 100}%`,
          backgroundPosition: framePosition(COLS, ROWS, frame % COLS, Math.floor(frame / COLS)),
          backgroundRepeat: "no-repeat",
        }}
      />
      {foodSprite && <FoodBite src={foodSprite} characterSize={size} />}
    </div>
  );
}

/** 食物被吃掉的那段動畫——畫在角色旁邊的地上。
 *
 *  **自己管自己的格數**：食物圖是單列 7 格（見 FOOD_EATING_SPRITES），跟角色那張
 *  7×3 完全是兩種規格，混在同一個計時器裡只會讓兩邊互相遷就。拆成獨立元件之後，
 *  角色該怎麼動還是怎麼動，食物自己演自己的。
 *
 *  **演完定格在最後一格（空盤）**，不繞回第一格：繞回去的話蛋糕會在吃完之後整塊
 *  長回來再吃一次，看起來像沒吃到。演完就停在空盤，等 mood 切回待機時整個消失。 */
function FoodBite({ src, characterSize }: { src: string; characterSize: number }) {
  const [frame, setFrame] = useState(0);
  const total = FOOD_SPRITE_COLS * FOOD_SPRITE_LOOPS;

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setFrame(0);
    const timer = setInterval(() => setFrame((f) => Math.min(f + 1, total - 1)), FOOD_FRAME_MS);
    return () => clearInterval(timer);
  }, [src, total]);

  // 尺寸與位置都跟著角色的大小等比算，換場地、換預覽框（背包那個 130px 的角色）都不用
  // 另外調。食物大約是角色的一半，擺在角色右邊、底部對齊腳邊的地面高度。
  const size = Math.round(characterSize * FOOD_SCALE);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        width: size,
        height: size,
        left: Math.round(characterSize * FOOD_LEFT),
        top: Math.round(characterSize * FOOD_TOP),
        backgroundImage: `url("${src}")`,
        backgroundSize: `${FOOD_SPRITE_COLS * 100}% 100%`,
        // 單列圖永遠落在第 0 列；frame % 7 讓第二輪回到同樣那七格。
        backgroundPosition: framePosition(FOOD_SPRITE_COLS, 1, frame % FOOD_SPRITE_COLS, 0),
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}
