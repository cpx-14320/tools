"use client";

import { useEffect, useRef, useState } from "react";
import { PetSprite, PET_ANIMATION_MS, petEatingDurationMs, type PetMood } from "@/components/expenses/pet-sprite";
import { PetShopModal } from "@/components/expenses/pet-shop";
import { PetBuyResultModal } from "@/components/expenses/pet-buy-result-modal";
import { PetBagModal } from "@/components/expenses/pet-bag-modal";
import { PetSigninModal } from "@/components/expenses/pet-signin-modal";
import { PetHelpModal } from "@/components/expenses/pet-help-modal";
import { PetRedeemModal } from "@/components/expenses/pet-redeem-modal";
import { IconImg } from "@/components/expenses/icon-img";
import { ICON_PATHS } from "@/components/expenses/icon-paths";
import { useToast } from "@/components/expenses/toast";
import {
  PET_ITEMS,
  effectiveOutfitId,
  levelFromXp,
  petBackground,
  petItemById,
  type PetItemKind,
} from "@/lib/expenses/pet";

interface PetState {
  coins: number;
  xp: number;
  outfitId: string;
  ownedOutfitIds: string[];
  backgroundId: string;
  ownedBackgroundIds: string[];
  foodCounts: Record<string, number>;
  /** 已經買到的動作狀態／目前勾起來的那幾個（狀態是複選的，見 pet-bag-modal.tsx）。 */
  ownedStateIds: string[];
  activeStateIds: string[];
  /** 今天是連續簽到的第幾天（0 ＝ 今天還沒簽到）。 */
  signinStreak: number;
  justEarned: { key: string; coins: number; label: string }[];
  /** 這一次進頁面剛好跨過孵化等級——先播一次孵化動畫再回到待機。 */
  justHatched: boolean;
}

/** 疊在場地下緣、餵食鍵底下那排入口（簽到／商店／衣服／背景）的其中一顆。
 *
 *  本來商店跟背包是疊在場地右上角的兩顆小圖示：背景換成實景圖之後那兩顆很容易被圖吃掉，
 *  而且「換衣服」跟「換背景」都藏在背包的頁籤裡、從外面看不出來。改成一排有名字的大
 *  圖示，四個入口一字排開，點哪顆會開什麼一眼就知道。 */
function StageNavButton({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-1 rounded-xl py-1 transition-transform active:scale-95"
    >
      <IconImg src={icon} alt={label} size={60} background={false} />
      <span className="text-[11px] font-medium text-[#4A3B7C]">{label}</span>
    </button>
  );
}

/** 狀態列那幾塊的共同高度（px）。等級框、星星框、說明鈕三個一樣高，排成一列才齊。 */
const HUD_H = 36;

/** 左右兩端固定、中間橫向拉伸的膠囊底圖（等級框 pet-level-*、星星框 pet-starcount-*）。
 *
 *  三張切片用同一個元素的三層 background 畫出來，不另外切三個 div：左端貼左、右端貼右、
 *  中間那張補滿剩下的寬度。只有中間會被拉伸，所以膠囊兩頭的圓弧跟亮面不管框多寬都不變形。
 *  端點寬度跟著高度等比算（等級圖 30×60、星星圖 36×72，縮到 HUD_H 高之後都是 18px）。 */
function pillBackground(name: string, capRatio: number) {
  const cap = Math.round(HUD_H * capRatio);
  return {
    backgroundImage: `url("/expenses/${name}-left.png"), url("/expenses/${name}-right.png"), url("/expenses/${name}-${name === "pet-level" ? "leftcenter" : "center"}.png")`,
    backgroundPosition: `left center, right center, ${cap}px center`,
    backgroundSize: `${cap}px 100%, ${cap}px 100%, calc(100% - ${cap * 2}px) 100%`,
    backgroundRepeat: "no-repeat",
    paddingLeft: cap - 4,
    paddingRight: cap - 4,
  } as const;
}

/** 待機多久之後插播一次動作狀態。太短會讓角色一直在動、看起來很吵；太長又像沒生效。 */
const ACTION_INTERVAL_MS = 12_000;

/** 餵食列的食物。PET_ITEMS 裡本來就是由便宜到貴排好的，這個順序就是「手上一份都沒有」
 *  時的預設排序（見下面 sortedFoods 的說明）。 */
const FOOD_ITEMS = PET_ITEMS.filter((i) => i.kind === "食物");

/** 餵食列的排序：手上有的排前面（多的更前面），同樣數量的再照價格由便宜到貴。
 *
 *  「有幾份」才是這一列要回答的問題——使用者滑到這裡是要餵東西，不是逛商店，手上有的
 *  東西不該被一堆買不起的擋在後面。都是 0 的時候就退回價格順序（也就是 PET_ITEMS 原本
 *  的順序），最便宜、最可能買得起的排在最前面。 */
function sortedFoods(counts: Record<string, number>) {
  return [...FOOD_ITEMS].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0) || a.price - b.price);
}

/** 讓一條橫向捲動的列可以**用滑鼠直接拖著滑**。
 *
 *  **為什麼需要**：那一列是 `overflow-x-auto`，而捲軸是藏起來的（no-scrollbar，露出來
 *  會在插畫場景上多一條灰條）。手指滑、滾輪轉都動得了，唯獨「按住往旁邊拖」——桌機
 *  使用者最直覺的那一招——瀏覽器原生不支援，於是整列看起來就是不會動。
 *
 *  只攔滑鼠（`pointerType === "mouse"`）：觸控本來就有原生的橫向捲動跟慣性，自己接管
 *  只會做出一個比較差的版本。
 *
 *  拖完要吃掉那一次 click：不然放開手的位置剛好在某顆食物上，就會順手餵下去一份
 *  ——使用者只是想滑過去看看有什麼。 */
function useDragScroll() {
  const ref = useRef<HTMLDivElement>(null);

  // 事件全部在 effect 裡掛到元素上，不回傳一包 onPointerXxx 讓呼叫端展開到 JSX：
  // 那樣每次 render 都要碰一次 ref（lint 會擋，見 react-hooks/refs），而且這些狀態
  // （按著沒、從哪裡開始拖）本來就不該進 render——畫面要變的只有 scrollLeft。
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let active = false;
    let startX = 0;
    let startLeft = 0;
    let moved = false;

    /** 放開手（或滾輪、觸控原生捲動停下來）之後，把位置吸附到最近一顆的左邊界，
     *  而且是**用 scrollTo 的 smooth 選項**滑過去，不是瞬間跳過去。
     *
     *  這裡刻意**不用 CSS 的 `scroll-snap-type`**——那個規格是「只要捲動位置不在
     *  吸附點上就立刻拉回去」，不分是使用者在拖、還是手動寫 `scrollLeft`，結果拖曳
     *  途中每寫一次 `scrollLeft` 就被拉回最近的吸附點一次，使用者看到的不是跟著
     *  手指滑過去，而是整條列用跳的（實測量過：拖到一半 scrollLeft 就已經等於吸附
     *  點，不是放開手才吸附）。改成放手後才用這個函式自己算最近的位置、自己動畫，
     *  拖曳過程完全不會被打斷。 */
    // 寫成 const + 箭頭函式而不是 function 宣告——後者會被提升到整個 effect 最前面，
    // TypeScript 對 el 的窄化（上面那行 if (!el) return）就套用不到裡面，每一行碰
    // el 的地方都要報一次「可能是 null」。
    const settle = () => {
      const items = [...el.children] as HTMLElement[];
      if (items.length < 2) return;
      // 用前兩格的間距當「一格的寬度」（含 gap），不假設所有格子等寬寫死一個數字
      // ——food-row 本來就是用 calc() 算寬度，版面改了這裡不用跟著改。
      const step = items[1].offsetLeft - items[0].offsetLeft;
      if (step <= 0) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      const nearest = Math.min(Math.max(Math.round(el.scrollLeft / step) * step, 0), maxScroll);
      if (Math.abs(nearest - el.scrollLeft) > 1) el.scrollTo({ left: nearest, behavior: "smooth" });
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      active = true;
      moved = false;
      startX = e.clientX;
      startLeft = el.scrollLeft;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!active) return;
      const dx = e.clientX - startX;
      // 4px 以內當成手震，不算拖曳——不然每次點食物都會被判定成拖過而吃不到。
      if (!moved && Math.abs(dx) <= 4) return;
      if (!moved) {
        moved = true;
        // **指標捕獲只在真的開始拖之後才抓**：抓了之後 click 會改派到捕獲的那個元素
        // （這一整列），底下那顆食物按鈕就永遠收不到點擊、餵不下去。所以單純的點擊
        // 全程不碰捕獲，只有確定在拖的時候才抓——抓了游標才能拖到列外面（甚至離開
        // 視窗）還繼續捲，不會卡在「以為還按著」的狀態。
        el.setPointerCapture(e.pointerId);
      }
      el.scrollLeft = startLeft - dx;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      const wasDrag = active && moved;
      active = false;
      if (wasDrag) settle();
    };
    // 拖完要吃掉那一次 click：不然放開手的位置剛好在某顆食物上就會順手餵下去一份，
    // 使用者只是想滑過去看看有什麼。捕獲階段攔，才來得及在按鈕收到之前擋下來。
    const onClickCapture = (e: MouseEvent) => {
      if (!moved) return;
      moved = false;
      e.preventDefault();
      e.stopPropagation();
    };
    // 滾輪、觸控的原生捲動也要吸附：等「停止捲動」之後（debounce 120ms 沒有新的
    // scroll 事件）才叫 settle()，不能在每個 scroll 事件裡都呼叫——那樣會在滾輪還
    // 在轉、手指還在滑的時候就被拉去吸附，變回同一個問題。拖曳時這裡也會收到
    // scroll 事件，但拖曳中 settle() 量到的距離通常 <1px（還在拖、位置還沒停），
    // debounce 到期時多半已經被 pointerup 的 settle() 處理過，兩邊重複呼叫也無妨
    // （scrollTo 到同一個位置第二次不會有動作）。
    let scrollTimer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(settle, 120);
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("click", onClickCapture, true);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("click", onClickCapture, true);
      el.removeEventListener("scroll", onScroll);
      clearTimeout(scrollTimer);
    };
  }, []);

  return ref;
}

/** 養成頁。
 *
 *  資料都是 page.tsx 在伺服器上讀好傳進來的，所以沒有「載入中」這個狀態，也不需要骨架。
 *  initialPet 已經是結算過的狀態（含 justEarned），不用再打一次 GET /api/expenses/pet。 */
export function PetView({ initialPet }: { initialPet: PetState | null }) {
  const [pet, setPet] = useState<PetState | null>(initialPet);
  const [shopOpen, setShopOpen] = useState(false);
  const [signinOpen, setSigninOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  // 背包的頁籤狀態放在這裡：「衣服」跟「背景」是兩顆不同的入口，各自要開在對應的那一頁。
  const [bagOpen, setBagOpen] = useState(false);
  const [bagKind, setBagKind] = useState<Exclude<PetItemKind, "食物">>("服裝");
  const openBag = (kind: Exclude<PetItemKind, "食物">) => {
    setBagKind(kind);
    setBagOpen(true);
  };
  // 剛孵化的那一次先演破殼動畫（結算時伺服器已經把造型換成孵化後的預設套裝了，動畫的
  // 最後一格正好就是那個姿勢，所以演完接回待機不會跳）。
  const [mood, setMood] = useState<PetMood>(initialPet?.justHatched ? "hatching" : "idle");
  // 連續餵第二次時 mood 已經是 "eating"、setMood 等於沒變，下面那個計時器就不會重新
  // 計時，第二次的動畫會被第一次的計時器提早切掉。用這個每次遞增的數字當重新計時的依據。
  const [feedNonce, setFeedNonce] = useState(0);
  // 正在吃的那個食物 id——有專屬動畫的食物要告訴 PetSprite 該播哪張圖、告訴底下的
  // 計時器該演多久（petEatingDurationMs，見 pet-sprite.tsx）。
  const [eatingFoodId, setEatingFoodId] = useState<string | undefined>(undefined);
  // 剛買到的東西——買成功之後跳一次回饋（見 PetBuyResultModal 開頭的說明，這是「動作
  // 結果不額外用文字講」這條原則唯一的例外）。
  const [buyResult, setBuyResult] = useState<{ itemId: string; qty: number; totalPrice: number } | null>(null);
  // 餵食列用滑鼠拖著滑（桌機最直覺的那一招，原生不支援，見 useDragScroll）。
  const foodRowRef = useDragScroll();
  // 現在正在演的那個動作狀態的精靈圖（只有 mood === "action" 時有意義）。
  const [actionSprite, setActionSprite] = useState<string | undefined>(undefined);
  // 動作的結果**大多不另外用文字講**：換衣服、換場地、餵食的結果畫面上直接看得到（角色
  // 換了一套、場地換了一張、經驗條往前跑），再疊一塊「場地換成星空書房」的訊息框只是把
  // 商店彈窗的第一行佔掉。失敗一律走共用的提示（useToast）。
  // 「買」是這條原則唯一的例外——錢扣了、東西進背包，畫面上除了一個勾勾徽章看不出
  // 任何變化，所以刻意保留一個購買成功的回饋（PetBuyResultModal，見 buyResult）。
  const showToast = useToast();

  /** 今日簽到。跟餵食／購買不同，它沒有品項，而且日期要前端給——伺服器時區不一定跟
   *  使用者同一個（跟 GET /api/expenses/pet 同一個理由）。 */
  async function signIn() {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
    const res = await fetch("/api/expenses/pet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "signin", today }),
    }).catch(() => null);
    const data: { pet?: PetState; error?: string } = (await res?.json().catch(() => ({}))) ?? {};
    if (data.pet) setPet(data.pet);
  }

  /** count 只有「買食物」會用到，一次買好幾份（見 pet-shop.tsx 的數量選擇器）。 */
  async function act(action: "feed" | "buy" | "equip" | "toggle", itemId: string, count = 1) {
    const res = await fetch("/api/expenses/pet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, itemId, count }),
    }).catch(() => null);
    const data: { pet?: PetState; error?: string } = (await res?.json().catch(() => ({}))) ?? {};
    if (data.error) {
      showToast(data.error);
      return;
    }
    if (data.pet) {
      setPet(data.pet);
      // 餵食時切成吃東西的動畫，跑完一輪自己回到待機（長度依這份食物有沒有專屬動畫
      // 而不同，見下面那個計時器）。
      if (action === "feed") {
        setMood("eating");
        setEatingFoodId(itemId);
        setFeedNonce((n) => n + 1);
      }
      // 買到東西本身在畫面上看不出變化（商店格子只是多一個勾勾），跳一次回饋講清楚
      // 花了多少、東西去哪了（見 PetBuyResultModal）。
      if (action === "buy") {
        const item = petItemById(itemId);
        if (item) setBuyResult({ itemId, qty: count, totalPrice: item.price * (item.kind === "食物" ? count : 1) });
      }
    }
  }

  // 算等級要提前到這裡：下面那個吃東西計時器要知道身上現在是不是蛋（食物專屬動畫
  // 還沒孵化不套用，見 petEatingDurationMs 的說明），原本 level 是在更後面才算的。
  const level = levelFromXp(pet?.xp ?? 0);

  // 孵化／動作狀態演一輪（PET_ANIMATION_MS）就回到待機；吃東西依「這份食物有沒有
  // 專屬動畫、而且已經孵化」決定演多久（petEatingDurationMs）——有專屬動畫的短很多，
  // 用通用時長的話畫面會定格在最後一格空等。計時器掛在 mood 上而不是寫在 act() 裡：
  // 連續餵好幾次時每次都會重新計時，不會被前一次的 setTimeout 提早切回待機。
  useEffect(() => {
    if (mood === "idle") return;
    const duration =
      mood === "eating" ? petEatingDurationMs(eatingFoodId, effectiveOutfitId(pet?.outfitId ?? "", level.level)) : PET_ANIMATION_MS;
    const timer = setTimeout(() => setMood("idle"), duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, feedNonce]);

  // 背包裡勾起來的動作狀態。角色待機時每隔一段時間從裡面隨機挑一個演一次——勾了好幾個
  // 就會輪流出現不同動作，一個都沒勾就只有待機。
  const activeStates = (pet?.activeStateIds ?? []).map((id) => petItemById(id)).filter((i) => i?.kind === "狀態" && i.action);
  useEffect(() => {
    if (activeStates.length === 0 || mood !== "idle") return;
    const timer = setTimeout(() => {
      const pick = activeStates[Math.floor(Math.random() * activeStates.length)];
      if (!pick) return;
      setActionSprite(pick.image);
      setMood("action");
    }, ACTION_INTERVAL_MS);
    return () => clearTimeout(timer);
    // activeStates 每次 render 都是新陣列，所以相依看的是「勾了哪幾個」這個字串，不是陣列本身。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, (pet?.activeStateIds ?? []).join(",")]);

  // 簽到是進頁面就自動結算的，所以 signinStreak > 0 就代表今天已經簽到了（簽到彈窗
  // 自己用這個數字判斷）。
  const streak = pet?.signinStreak ?? 0;

  return (
    // 整頁就是一張遊戲畫面：外殼那層的左右／上下留白在養成頁關掉（見 ExpensesMobileShell
    // 的 fullBleed），場地圖直接貼到四個邊，狀態列、說明、餵食鍵、入口全部疊在圖上。
    // 本來的標題列、等級卡、經驗值卡、簽到卡都收掉了——那是「一張一張白卡」的資訊頁長相，
    // 跟角色站在房間裡這件事互相打架。
    <div className="relative flex flex-1 flex-col">
      {/* flex-1 而不是 min-h-full：外殼那層是 min-h-full 的 flex 直欄，高度是「至少跟
          捲動區一樣高」而不是固定值，百分比高度在那種父層上量不出東西，撐不滿會露出
          底下的紫色漸層。 */}
      <div
        className="relative w-full flex-1"
        style={{ background: petBackground(pet?.backgroundId ?? "") }}
      >
        {/* 上方狀態列：等級框（裡面接著經驗條）、星星幣、說明鈕排成一列，三個等高。
            沒有外框底板——每個元素自己就是一張畫好的圖，再墊一塊半透明白底會讓三張圖
            各自被框一次、反而更雜。 */}
        <div className="absolute inset-x-3 top-3 flex items-center gap-2">
          {/* 等級框吃掉剩下的寬度：經驗條就放在 LV 後面，兩個講的是同一件事（現在幾級、
              離下一級多遠），分成兩塊反而要看兩個地方。 */}
          <div
            className="flex min-w-0 flex-1 items-center gap-2 text-sm font-extrabold tracking-wide text-white"
            style={{ ...pillBackground("pet-level", 0.5), height: HUD_H }}
          >
            {/* 加一層深色陰影：白字壓在粉紅框上對比不夠，陰影一推字就跳出來。 */}
            <span className="shrink-0" style={{ textShadow: "0 1px 2px rgba(138,30,80,0.55)" }}>
              LV.{level.level}
            </span>
            {/* 經驗條的軌道壓在粉紅色框上，所以用半透明白當底、實心白當進度；數字疊在
                條上面（框裡放不下第二行字）。 */}
            <span className="relative h-3.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/35">
              <span className="block h-full rounded-full bg-white/90" style={{ width: `${level.pct}%` }} />
              <span className="absolute inset-0 grid place-items-center text-[9px] font-bold tabular-nums text-[#B23A6F]">
                {level.xpInLevel} / {level.xpNeeded}
              </span>
            </span>
          </div>

          {/* 星星固定貼左邊的圓端、數字靠右邊的圓端：數字變長時整個框往左長，星星跟數字
              各自待在原位，不會因為多一位數就整排跟著位移。
              整框可以點，開「活動序號」——想到要更多星星幣的時候，眼睛本來就在這個數字上，
              不用另外在場地上多擺一顆平常用不到的按鈕。 */}
          <button
            type="button"
            onClick={() => setRedeemOpen(true)}
            aria-label="輸入活動序號"
            className="flex shrink-0 items-center gap-1.5 text-sm font-bold tabular-nums text-[#8A5A2B] transition-transform active:scale-95"
            // minWidth 放寬一點：星星幣是會累積的數字，十萬～百萬位（七位數）才是常態的
            // 上限。框太窄的話每多一位就要往左長一截，整排跟著抖；先留到放得下七位數。
            style={{ ...pillBackground("pet-starcount", 0.5), height: HUD_H, minWidth: 124 }}
          >
            <IconImg src={ICON_PATHS.petStar} alt="星星幣" size={20} background={false} />
            <span className="ml-auto text-right">{pet?.coins ?? 0}</span>
          </button>

          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            aria-label="養成的說明"
            // 畫好的圓鈕＋問號兩張圖疊起來，跟場地上其他按鈕（餵食框、入口圖示）同一套插畫
            // 風格；原本是半透明白底的文字「?」，在房間圖上看起來像是網頁元件混進遊戲畫面。
            className="grid shrink-0 place-items-center bg-contain bg-center bg-no-repeat transition-transform active:scale-90"
            style={{ backgroundImage: 'url("/expenses/pet-round_button.png")', width: HUD_H, height: HUD_H }}
          >
            <span aria-hidden className="size-4 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: 'url("/expenses/pet-question_mark.png")' }} />
          </button>
        </div>

        {/* 角色釘在場地 45% 高的位置：六張房間圖的地毯／地板中心都落在這附近，
            正中央（50%）站會偏低、貼到下面那排餵食鍵，純置中則因為精靈圖四周留白
            看起來像浮在半空。 */}
        <div className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2">
          <PetSprite
            mood={mood}
            actionSprite={actionSprite}
            outfitId={effectiveOutfitId(pet?.outfitId ?? "", level.level)}
            foodId={eatingFoodId}
          />
        </div>

        {/* 下半部由下往上疊：入口列在最底、餵食鍵在它上面、動作提示再上面一層。
            bottom-24 是讓開底部導覽列的高度——場地圖本身鋪到卡片最底下（外殼那層的
            pb-24 在這一頁關掉了），但按鈕不能被導覽列蓋住。 */}
        <div className="absolute inset-x-3 bottom-24 flex flex-col gap-2">
          {/* 餵食鍵：可以左右滑的一列，按鈕框是 pet-buttonbox.png、食物圖疊在框中間。
              沒有的食物整顆淡掉（不是藏起來）：它同時也是「商店有這個、去買」的提示。

              一次露出 4.5 格（寬度 = (可視寬 − 4 個間距) ÷ 4.5）：第五格露出一半，讓人
              一眼看出右邊還有東西可以滑，不用另外畫箭頭或圓點。食物會愈加愈多，固定幾格
              的排法每加一種就要重算版面。
              pt-1：持有數量的徽章凸出按鈕上緣 2px，overflow-x-auto 會連垂直方向一起裁，
              不留這點上緣留白的話徽章會被切掉。 */}
          <div
            ref={foodRowRef}
            // **故意不用 CSS 的 scroll-snap-type**：試過 `snap-x snap-mandatory` 之後
            // 量到的行為是——只要 mandatory 開著，瀏覽器會在每一次 `scrollLeft` 改變
            // 之後立刻把位置拉回最近的吸附點，不分那次改動是放開手之後的收尾、還是
            // 使用者手指還按著正在拖。結果整條列變成「拖到一半就已經是下一顆的位置」，
            // 跟拖著一路滑過去完全是兩種手感，正好是這次要修的問題，不是在修別的。
            // 吸附改成完全交給 JS 自己算（見 useDragScroll 的 settle()）：拖曳、滾輪、
            // 原生觸控捲動全部共用同一個「停下來才吸附」的邏輯，不會被 CSS 搶拍。
            className="no-scrollbar flex items-end gap-2 overflow-x-auto pt-1"
            // touch-action: pan-x——明講「這一列只吃橫向的手勢」，直向交還給外層捲動。
            // 沒寫的話某些瀏覽器會先觀望方向再決定，第一下常常被判成直向而整列不動。
            style={{ touchAction: "pan-x" }}
            // 三種操作都要能滑：手指滑（原生）、滑鼠拖（useDragScroll）、滾輪轉（這裡）。
            // 滾輪：在寬螢幕上滾輪只會捲垂直方向，而這一頁沒有垂直捲軸（場地正好塞滿），
            // 結果就是「怎麼轉都不會動」，所以把垂直滾輪轉成橫向捲動——用 scrollBy 的
            // smooth 模式而不是直接改 scrollLeft，轉一下就滑過去，不是瞬間跳過去；轉完
            // 之後 useDragScroll 掛的 scroll 監聽也會接手把位置收齊到最近一格。
            onWheel={(e) => {
              if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
              e.currentTarget.scrollBy({ left: e.deltaY, behavior: "smooth" });
            }}
          >
            {sortedFoods(pet?.foodCounts ?? {}).map((item) => {
              const count = pet?.foodCounts?.[item.id] ?? 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => count > 0 && act("feed", item.id)}
                  // **不用原生 disabled**：點擊本來就已經在上面那行用 count > 0 擋掉了，
                  // disabled 只負責擋手滑點到。但手機上觸到一顆原生 disabled 的按鈕會連
                  // 「這是一次要拖動的手勢」都辨識不出來，整根手指滑過去變成完全沒反應
                  // ——新帳號一份食物都沒有，每一顆都是 disabled，整排滑鍵從第一天就是
                  // 死的。改成 aria-disabled（純粹語意、不影響事件），外觀照舊用透明度
                  // 表示「吃不了」。
                  aria-disabled={count === 0}
                  // 框裡只放得下食物圖，名字改成掛在 aria-label／title 上——四顆框塞四行
                  // 字會把框本身的插畫擠掉，而食物圖本身已經夠好認了。
                  aria-label={`餵${item.name}（還有 ${count} 份）`}
                  title={`${item.name} ×${count}`}
                  className={`relative grid aspect-[249/230] w-[calc((100%-2rem)/4.5)] shrink-0 place-items-center bg-contain bg-center bg-no-repeat transition-transform active:scale-95 ${
                    count === 0 ? "opacity-40" : ""
                  }`}
                  style={{ backgroundImage: `url("${ICON_PATHS.petButtonBox}")` }}
                >
                  <IconImg src={item.image} alt={item.name} size={52} background={false} />
                  {/* 持有數量釘在框的右上角——框裡本來就只有食物圖，數字壓在圖上會糊成一團。 */}
                  <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-[#6F5ED4] px-1 text-[10px] font-semibold leading-[18px] text-white tabular-nums">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 四個入口緊接在餵食鍵底下：上面那排是「餵」，這排是「去別的地方」。
              整排墊一層半透明白底——圖示本身是去背插圖、底下那行字是深紫色，直接壓在
              房間圖上會跟傢俱的花紋糊在一起。 */}
          <div className="flex items-start gap-1 rounded-2xl bg-white/80 px-1 py-1 backdrop-blur">
            <StageNavButton label="簽到" icon={ICON_PATHS.petNavCheckin} onClick={() => setSigninOpen(true)} />
            <StageNavButton label="商店" icon={ICON_PATHS.petNavShop} onClick={() => setShopOpen(true)} />
            <StageNavButton label="服裝" icon={ICON_PATHS.petNavOutfit} onClick={() => openBag("服裝")} />
            <StageNavButton label="背景" icon={ICON_PATHS.petNavBackground} onClick={() => openBag("背景")} />
          </div>
        </div>
      </div>

      <PetHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      <PetShopModal
        open={shopOpen}
        onClose={() => setShopOpen(false)}
        level={level.level}
        pet={{
          coins: pet?.coins ?? 0,
          outfitId: pet?.outfitId ?? "",
          ownedOutfitIds: pet?.ownedOutfitIds ?? [],
          backgroundId: pet?.backgroundId ?? "",
          ownedBackgroundIds: pet?.ownedBackgroundIds ?? [],
          ownedStateIds: pet?.ownedStateIds ?? [],
          foodCounts: pet?.foodCounts ?? {},
        }}
        onAct={act}
      />

      <PetBuyResultModal
        open={buyResult !== null}
        item={buyResult ? (petItemById(buyResult.itemId) ?? null) : null}
        qty={buyResult?.qty ?? 1}
        totalPrice={buyResult?.totalPrice ?? 0}
        onClose={() => setBuyResult(null)}
      />

      <PetBagModal
        open={bagOpen}
        onClose={() => setBagOpen(false)}
        level={level.level}
        kind={bagKind}
        onKindChange={setBagKind}
        pet={{
          outfitId: pet?.outfitId ?? "",
          ownedOutfitIds: pet?.ownedOutfitIds ?? [],
          backgroundId: pet?.backgroundId ?? "",
          ownedBackgroundIds: pet?.ownedBackgroundIds ?? [],
          ownedStateIds: pet?.ownedStateIds ?? [],
          activeStateIds: pet?.activeStateIds ?? [],
        }}
        onEquip={(itemId) => act("equip", itemId)}
        onToggleState={(itemId) => act("toggle", itemId)}
      />

      <PetSigninModal open={signinOpen} onClose={() => setSigninOpen(false)} streak={streak} onSignIn={signIn} />

      <PetRedeemModal
        open={redeemOpen}
        onClose={() => setRedeemOpen(false)}
        onRedeem={async (code) => {
          const res = await fetch("/api/expenses/pet", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "redeem", code }),
          }).catch(() => null);
          const data: { pet?: PetState; error?: string } = (await res?.json().catch(() => ({}))) ?? {};
          if (data.pet) {
            setPet(data.pet);
            return null;
          }
          return data.error ?? "兌換失敗，再試一次";
        }}
      />

    </div>
  );
}
