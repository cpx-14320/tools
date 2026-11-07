"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/expenses/modal";
import { ListCard, ListRow } from "@/components/expenses/list-row";
import { ProgressBar } from "@/components/expenses/progress-bar";
import { PetSprite, PET_EATING_MS, type PetMood } from "@/components/expenses/pet-sprite";
import { PetShopModal } from "@/components/expenses/pet-shop";
import { PetBagModal } from "@/components/expenses/pet-bag-modal";
import { PetSigninModal } from "@/components/expenses/pet-signin-modal";
import { IconImg } from "@/components/expenses/icon-img";
import { ICON_PATHS } from "@/components/expenses/icon-paths";
import { text } from "@/components/expenses/theme";
import {
  BUDGET_KEPT_COINS,
  ENTRY_COINS,
  PET_ITEMS,
  SIGNIN_STEP_COINS,
  SIGNIN_STREAK_CAP,
  effectiveOutfitId,
  levelFromXp,
  petBackground,
  petItemById,
  signinCoins,
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
  /** 今天是連續簽到的第幾天（0 ＝ 今天還沒簽到）。 */
  signinStreak: number;
  justEarned: { key: string; coins: number; label: string }[];
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

/** 「星星圖＋數字」——說明彈窗裡那幾列獎勵金額都長這樣，收成一個元件才不會四個地方
 *  各寫一次 emoji 跟樣式。 */
function CoinAmount({ value }: { value: number | string }) {
  return (
    <span className="flex items-center gap-1 text-xs font-semibold tabular-nums text-[#6F5FD6]">
      <IconImg src={ICON_PATHS.petStar} alt="星星幣" size={14} background={false} />
      {value}
    </span>
  );
}

/** 餵食鍵那一排的食物（固定四種，見 lib/expenses/pet.ts 的說明）。 */
const FOOD_ITEMS = PET_ITEMS.filter((i) => i.kind === "食物");

/** 養成頁。
 *
 *  資料都是 page.tsx 在伺服器上讀好傳進來的，所以沒有「載入中」這個狀態，也不需要骨架。
 *  initialPet 已經是結算過的狀態（含 justEarned），不用再打一次 GET /api/expenses/pet。 */
export function PetView({ initialPet }: { initialPet: PetState | null }) {
  const [pet, setPet] = useState<PetState | null>(initialPet);
  const [shopOpen, setShopOpen] = useState(false);
  const [signinOpen, setSigninOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // 背包的頁籤狀態放在這裡：「衣服」跟「背景」是兩顆不同的入口，各自要開在對應的那一頁。
  const [bagOpen, setBagOpen] = useState(false);
  const [bagKind, setBagKind] = useState<Exclude<PetItemKind, "食物">>("服裝");
  const openBag = (kind: Exclude<PetItemKind, "食物">) => {
    setBagKind(kind);
    setBagOpen(true);
  };
  const [mood, setMood] = useState<PetMood>("idle");
  // 連續餵第二次時 mood 已經是 "eating"、setMood 等於沒變，下面那個計時器就不會重新
  // 計時，第二次的動畫會被第一次的計時器提早切掉。用這個每次遞增的數字當重新計時的依據。
  const [feedNonce, setFeedNonce] = useState(0);
  // 進頁面時剛結算到的獎勵先報一句。放在 state 初始值而不是 effect 裡：這是算得出來的
  // 初始畫面，不是副作用。
  const [message, setMessage] = useState<string | null>(() =>
    initialPet?.justEarned?.length
      ? `獲得 ${initialPet.justEarned.reduce((s, r) => s + r.coins, 0)} 顆星星幣：${initialPet.justEarned.map((r) => r.label).join("、")}`
      : null,
  );

  /** count 只有「買食物」會用到，一次買好幾份（見 pet-shop.tsx 的數量選擇器）。 */
  async function act(action: "feed" | "buy" | "equip", itemId: string, count = 1) {
    const res = await fetch("/api/expenses/pet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, itemId, count }),
    }).catch(() => null);
    const data: { pet?: PetState; error?: string } = (await res?.json().catch(() => ({}))) ?? {};
    if (data.error) {
      setMessage(data.error);
      return;
    }
    if (data.pet) {
      setPet(data.pet);
      // 餵食時切成吃東西的動畫，跑完一輪（PET_EATING_MS）自己回到待機。
      if (action === "feed") {
        setMood("eating");
        setFeedNonce((n) => n + 1);
      }
      const item = petItemById(itemId);
      setMessage(
        action === "feed"
          ? `餵了${item?.name}，經驗值 +${item?.xp}`
          : action === "buy"
            ? item?.kind === "食物"
              ? `買了${item?.name}，放進背包了`
              : item?.kind === "背景"
                ? `買了${item?.name}，場地換好了`
                : `買了${item?.name}，已經換上`
            : item?.kind === "背景"
              ? `場地換成${item?.name}`
              : `換上${item?.name}`,
      );
    }
  }

  // 吃東西的動畫跑完一輪就回到待機。計時器掛在 mood 上而不是寫在 act() 裡：連續餵
  // 好幾次時每次都會重新計時，不會被前一次的 setTimeout 提早切回待機。
  useEffect(() => {
    if (mood !== "eating") return;
    const timer = setTimeout(() => setMood("idle"), PET_EATING_MS);
    return () => clearTimeout(timer);
  }, [mood, feedNonce]);

  const level = levelFromXp(pet?.xp ?? 0);
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
        {/* 左上角的狀態：星星幣在上、等級經驗接在底下。兩塊都墊半透明白底——背景換成
            實景圖之後，純文字直接壓在圖上有的地方看得到、有的地方（深色窗戶、地毯花紋）
            整個糊掉。 */}
        <div className="absolute left-3 top-3 flex w-[48%] flex-col items-start gap-1.5">
          <span className="flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 text-sm font-semibold tabular-nums text-[#6F5FD6] backdrop-blur">
            <IconImg src={ICON_PATHS.petStar} alt="星星幣" size={16} background={false} />
            {pet?.coins ?? 0}
          </span>
          <div className="w-full rounded-2xl bg-white/85 px-2.5 py-1.5 backdrop-blur">
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-[#6F5FD6]">
              <span>Lv.{level.level}</span>
              <span className="tabular-nums">
                {level.xpInLevel} / {level.xpNeeded}
              </span>
            </div>
            <ProgressBar pct={level.pct} tone="brand" />
          </div>
        </div>

        {/* 說明收在右上角那顆問號裡（本來掛在「養成」標題旁邊，標題整個拿掉了）。 */}
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          aria-label="養成的說明"
          className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-white/85 text-sm font-bold text-[#6F5FD6] backdrop-blur transition-colors hover:bg-white"
        >
          ?
        </button>

        {/* 角色釘在場地 45% 高的位置：六張房間圖的地毯／地板中心都落在這附近，
            正中央（50%）站會偏低、貼到下面那排餵食鍵，純置中則因為精靈圖四周留白
            看起來像浮在半空。 */}
        <div className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2">
          <PetSprite mood={mood} outfitId={effectiveOutfitId(pet?.outfitId ?? "", level.level)} />
        </div>

        {/* 下半部由下往上疊：入口列在最底、餵食鍵在它上面、動作提示再上面一層。
            bottom-24 是讓開底部導覽列的高度——場地圖本身鋪到卡片最底下（外殼那層的
            pb-24 在這一頁關掉了），但按鈕不能被導覽列蓋住。 */}
        <div className="absolute inset-x-3 bottom-24 flex flex-col gap-2">
          {/* 餵食鍵：一排四顆，按鈕框是 pet-buttonbox.png、食物圖疊在框中間。
              沒有的食物整顆淡掉（不是藏起來）：格數固定四格，少一格會讓剩下的跳位置。 */}
          <div className="flex items-end gap-2">
            {FOOD_ITEMS.map((item) => {
              const count = pet?.foodCounts?.[item.id] ?? 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => count > 0 && act("feed", item.id)}
                  disabled={count === 0}
                  // 框裡只放得下食物圖，名字改成掛在 aria-label／title 上——四顆框塞四行
                  // 字會把框本身的插畫擠掉，而食物圖本身已經夠好認了。
                  aria-label={`餵${item.name}（還有 ${count} 份）`}
                  title={`${item.name} ×${count}`}
                  className={`relative grid aspect-[249/230] flex-1 place-items-center bg-contain bg-center bg-no-repeat transition-transform active:scale-95 ${
                    count === 0 ? "opacity-40" : ""
                  }`}
                  style={{ backgroundImage: `url("${ICON_PATHS.petButtonBox}")` }}
                >
                  <IconImg src={item.image} alt={item.name} size={60} background={false} />
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
            <StageNavButton label="衣服" icon={ICON_PATHS.petNavOutfit} onClick={() => openBag("服裝")} />
            <StageNavButton label="背景" icon={ICON_PATHS.petNavBackground} onClick={() => openBag("背景")} />
          </div>
        </div>
      </div>

      {/* 怎麼賺星星幣——右上角那顆問號開的說明。 */}
      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="養成">
        <p className={`${text.muted} leading-relaxed`}>好好記帳就能賺星星幣，拿去餵角色、換衣服。</p>
        <p className={text.sectionHeading}>怎麼賺星星幣</p>
        <ListCard>
          <ListRow name="每日簽到（打開記帳本就算）" right={<CoinAmount value={signinCoins(1)} />} />
          <ListRow name={`連續簽到第 2～${SIGNIN_STREAK_CAP} 天`} right={<CoinAmount value={`${signinCoins(2)}～${signinCoins(SIGNIN_STREAK_CAP)}`} />} />
          <ListRow name="每記一筆帳" right={<CoinAmount value={ENTRY_COINS} />} />
          <ListRow name="上個月每個分類都沒超支" right={<CoinAmount value={BUDGET_KEPT_COINS} />} />
        </ListCard>
        <p className={`${text.faint} leading-relaxed`}>
          連續簽到是累加的：第一天 {signinCoins(1)}、第二天再多 {SIGNIN_STEP_COINS * 2}、第三天再多 {SIGNIN_STEP_COINS * 3}
          ……連到第 {SIGNIN_STREAK_CAP} 天那天一次拿 {signinCoins(SIGNIN_STREAK_CAP)}；斷掉就從頭算，第 {SIGNIN_STREAK_CAP + 1}{" "}
          天之後維持在 {signinCoins(SIGNIN_STREAK_CAP)} 不再往上加。
        </p>
        <p className={`${text.faint} leading-relaxed`}>
          星星幣只看記帳習慣，不看你有多少錢——一筆大額支出不會讓角色跟著「變窮」。
          食物的價格跟經驗值是一比一，花掉多少就換回多少。
        </p>
      </Modal>

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
          foodCounts: pet?.foodCounts ?? {},
        }}
        message={message}
        onAct={act}
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
        }}
        onEquip={(itemId) => act("equip", itemId)}
      />

      <PetSigninModal open={signinOpen} onClose={() => setSigninOpen(false)} streak={streak} />

    </div>
  );
}
