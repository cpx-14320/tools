"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/expenses/page-header";
import { Card, CardBody } from "@/components/expenses/card";
import { ListCard, ListRow } from "@/components/expenses/list-row";
import { ProgressBar } from "@/components/expenses/progress-bar";
import { PetSprite, petStage, PET_EATING_MS, type PetMood } from "@/components/expenses/pet-sprite";
import { PetShopModal } from "@/components/expenses/pet-shop";
import { PetBagModal } from "@/components/expenses/pet-bag-modal";
import { IconImg } from "@/components/expenses/icon-img";
import { ICON_PATHS } from "@/components/expenses/icon-paths";
import { text } from "@/components/expenses/theme";
import {
  BUDGET_KEPT_COINS,
  ENTRY_COINS,
  PET_ITEMS,
  SIGNIN_STEP_COINS,
  SIGNIN_STREAK_CAP,
  levelFromXp,
  petBackground,
  petItemById,
  signinCoins,
  wealthTier,
} from "@/lib/expenses/pet";
import { netWorth, type AccountDTO } from "@/lib/expenses/accounts";
import { type AccountTypeDTO } from "@/lib/expenses/account-types";
import { type CategoryDTO } from "@/lib/expenses/categories";
import { type TransactionDTO } from "@/lib/expenses/transactions";
import { type TransferDTO } from "@/lib/expenses/transfers";
import { formatCurrency } from "@/lib/format";

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

/** 疊在場地右上角的小圖示鈕（商店、背包）——圖直接放上去，不墊白色圓底。
 *
 *  圖本身已經是有造型、有顏色的去背插圖，再套一層白圓等於把它框在一個跟場地無關的
 *  方塊裡；去掉之後兩顆看起來就是「場地裡的東西」，跟角色同一個世界。 */
function StageIconButton({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    // flex 而不是預設的 inline 內容流：IconImg 是 inline-block，在按鈕裡會按基線對齊，
    // 底下多出一截行高的空間（量到 40px 的圖撐成 46px 高的按鈕）。
    <button type="button" onClick={onClick} aria-label={label} title={label} className="flex transition-opacity hover:opacity-80">
      <IconImg src={icon} alt={label} size={40} background={false} />
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

/** 食物背包／商店的食物清單——骨架跟真畫面都用同一份，格數才不會對不上。 */
const FOOD_ITEMS = PET_ITEMS.filter((i) => i.kind === "食物");

/** 養成頁。
 *
 *  資料都是 page.tsx 在伺服器上讀好傳進來的，所以沒有「載入中」這個狀態，也不需要骨架。
 *  initialPet 已經是結算過的狀態（含 justEarned），不用再打一次 GET /api/expenses/pet。 */
export function PetView({
  initialPet,
  /** 這五份只用來算淨資產、決定角色的「財富等級」，這一頁不會改它們。 */
  accounts,
  accountTypes,
  categories,
  transactions,
  transfers,
}: {
  initialPet: PetState | null;
  accounts: AccountDTO[];
  accountTypes: AccountTypeDTO[];
  categories: CategoryDTO[];
  transactions: TransactionDTO[];
  transfers: TransferDTO[];
}) {
  const [pet, setPet] = useState<PetState | null>(initialPet);
  const [shopOpen, setShopOpen] = useState(false);
  const [bagOpen, setBagOpen] = useState(false);
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
  const net = netWorth(accounts, accountTypes, transactions, categories, transfers);
  const tier = wealthTier(net);
  // 簽到是進頁面就自動結算的，所以 signinStreak > 0 就代表今天已經簽到了。
  const streak = pet?.signinStreak ?? 0;
  const signedInToday = streak > 0;
  const outfit = petItemById(pet?.outfitId ?? "");

  return (
    <div className="flex flex-col gap-4">
      {/* 說明跟賺幣規則都收在標題右邊的問號裡（PageHeader 的 help），跟記帳本其他頁一致。 */}
      <PageHeader
        flush
        title="養成"
        help={
          <>
            <p className={`${text.muted} leading-relaxed`}>好好記帳就能賺星星幣，拿去餵角色、換衣服。</p>
            <p className={text.sectionHeading}>怎麼賺星星幣</p>
            <ListCard>
              <ListRow name="每日簽到（打開記帳本就算）" right={<CoinAmount value={signinCoins(1)} />} />
              <ListRow
                name={`連續簽到第 2～${SIGNIN_STREAK_CAP} 天`}
                right={
                  <CoinAmount value={`${signinCoins(2)}～${signinCoins(SIGNIN_STREAK_CAP)}`} />
                }
              />
              <ListRow name="每記一筆帳" right={<CoinAmount value={ENTRY_COINS} />} />
              <ListRow name="上個月每個分類都沒超支" right={<CoinAmount value={BUDGET_KEPT_COINS} />} />
            </ListCard>
            <p className={`${text.faint} leading-relaxed`}>
              連續簽到是累加的：第一天 {signinCoins(1)}、第二天再多 {SIGNIN_STEP_COINS * 2}、第三天再多 {SIGNIN_STEP_COINS * 3}
              ……連到第 {SIGNIN_STREAK_CAP} 天那天一次拿 {signinCoins(SIGNIN_STREAK_CAP)}；斷掉就從頭算，第 {SIGNIN_STREAK_CAP + 1}{" "}
              天之後維持在 {signinCoins(SIGNIN_STREAK_CAP)} 不再往上加。
            </p>
            <p className={`${text.faint} leading-relaxed`}>
              星星幣只看記帳習慣，不看你有多少錢——淨資產只拿來算上面那個理財段位，才不會因為一筆大額支出就讓角色跟著「變窮」。
              食物的價格跟經驗值是一比一，花掉多少就換回多少。
            </p>
          </>
        }
      />

      {/* 角色場地：平常待機呼吸，餵食時切成吃東西的動畫、跑完一輪自己回到待機。 */}
      <Card>
        <CardBody>
          {/* 場地高度固定，角色置中；換背景、換裝都只是換這塊的底色跟角色色相，版面
              不會跟著變動。角色本身是固定 110px（見 PetSprite 的 size），所以場地不用
              跟著螢幕寬度長成一個很大的正方形——那只會在角色四周留一大片空白。 */}
          {/* 星星幣釘在左上、商店跟背包釘在右上——三個都疊在場地上（absolute），不佔
              版面。本來商店是底下一整列的入口卡，為了一顆按鈕吃掉 80px；星星幣也只在
              那張卡上出現，要看餘額得先捲下去。 */}
          <div
            className="relative grid aspect-[9/12] w-full place-items-center rounded-2xl p-3"
            style={{ background: petBackground(pet?.backgroundId ?? "") }}
          >
            <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 text-sm font-semibold tabular-nums text-[#6F5FD6] backdrop-blur">
              <IconImg src={ICON_PATHS.petStar} alt="星星幣" size={16} background={false} />
              {pet?.coins ?? 0}
            </span>
            <span className="absolute right-3 top-3 flex flex-col">
              <StageIconButton label="商店" onClick={() => setShopOpen(true)} icon={ICON_PATHS.petShop} />
              <StageIconButton label="背包" onClick={() => setBagOpen(true)} icon={ICON_PATHS.petBag} />
            </span>
            <PetSprite stage={petStage(level.level)} mood={mood} hueRotate={outfit?.hueRotate ?? 0} />
          </div>

          {/* 「散步」拿掉了：新的角色圖只有正面定點的待機／吃東西兩種動畫，沒有側面
              走路那一組，留著一顆按不出動作的按鈕只會讓人以為壞了。 */}
          <div className="mt-3 min-w-0">
            <p className={text.sectionHeading}>Lv.{level.level}</p>
            <p className={text.muted}>
              {tier.name}・淨資產 {formatCurrency(net)}
            </p>
          </div>

          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <span className={text.muted}>經驗值</span>
              <span className={`tabular-nums ${text.muted}`}>
                {level.xpInLevel} / {level.xpNeeded}
              </span>
            </div>
            <ProgressBar pct={level.pct} tone="brand" />
          </div>
        </CardBody>
      </Card>

      {/* 食物背包——固定顯示三種食物的持有數量，直接點了就吃（消耗一份、換成經驗值）。
          在商店買的食物進的是這裡，不是點了商店格子就直接吃掉；兩個動作分開。 */}
      <Card>
        <CardBody className="flex items-center justify-between gap-2">
          {FOOD_ITEMS.map((item) => {
            const count = pet?.foodCounts?.[item.id] ?? 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => count > 0 && act("feed", item.id)}
                disabled={count === 0}
                className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-1 ${count === 0 ? "opacity-40" : ""}`}
              >
                <IconImg src={item.image} alt={item.name} size={40} />
                <span className="text-[11px] font-medium text-[#4A3B7C]">
                  {item.name}
                  <span className="tabular-nums"> ×{count}</span>
                </span>
              </button>
            );
          })}
        </CardBody>
      </Card>

      {/* 簽到：進這一頁就自動簽到（見 settlePetRewards），所以這一塊是「結果」不是
          「按鈕」——它要回答的是「我連幾天了、今天拿到多少、明天會拿多少」。
          擺在食物下面：上面兩塊（角色、食物）是「現在可以做什麼」，簽到是今天已經發生
          的結果，不需要搶在互動前面。 */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between gap-2">
            <p className={text.sectionHeading}>每日簽到</p>
            <span className="text-xs font-semibold tabular-nums text-[#6F5FD6]">
              {signedInToday ? `今天 ＋${signinCoins(streak)}` : "今天還沒簽到"}
            </span>
          </div>
          <p className={`mt-0.5 ${text.muted}`}>
            {signedInToday
              ? streak >= SIGNIN_STREAK_CAP
                ? `已連續 ${streak} 天，每天都是 ${signinCoins(SIGNIN_STREAK_CAP)} 顆`
                : `已連續 ${streak} 天，明天連上去是 ＋${signinCoins(streak + 1)}`
              : "打開這一頁就會自動簽到"}
          </p>
          {/* 格子畫的是「這一輪連續簽到的進度」，不是最近七天的日曆：第一天就在第一格，
              斷掉就回到第一格，連滿 SIGNIN_STREAK_CAP 天之後一直停在最後一格。
              本來是「N 天前／今天」的日曆排法，但那排在講的是哪一天有沒有簽到，跟上面
              那句「已連續 N 天，明天連上去是 ＋X」問的不是同一件事——使用者要看的是
              「我走到第幾格了、下一格有多少」，所以改成直接標第幾天。 */}
          <div className="mt-3 flex gap-1.5">
            {Array.from({ length: SIGNIN_STREAK_CAP }, (_, i) => {
              const day = i + 1;
              // streak 超過上限之後一律停在最後一格（第 8 天起獎勵也不再往上加）。
              const current = Math.min(streak, SIGNIN_STREAK_CAP);
              const done = day <= current;
              const isCurrent = day === current;
              return (
                <div key={day} className="flex flex-1 flex-col items-center gap-1">
                  <span
                    className={`grid h-8 w-full place-items-center rounded-xl text-[11px] font-semibold tabular-nums ${
                      done ? "bg-[#6F5ED4] text-white" : "bg-[#F3EFFC] text-[#C7BFE6]"
                    }`}
                  >
                    {done && <IconImg src={ICON_PATHS.petStar} alt="已簽到" size={16} background={false} />}
                  </span>
                  <span className={`text-[10px] ${isCurrent ? "font-semibold text-[#6F5FD6]" : text.faint}`}>第 {day} 天</span>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>


      <PetShopModal
        open={shopOpen}
        onClose={() => setShopOpen(false)}
        stage={petStage(level.level)}
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
        stage={petStage(level.level)}
        pet={{
          outfitId: pet?.outfitId ?? "",
          ownedOutfitIds: pet?.ownedOutfitIds ?? [],
          backgroundId: pet?.backgroundId ?? "",
          ownedBackgroundIds: pet?.ownedBackgroundIds ?? [],
        }}
        onEquip={(itemId) => act("equip", itemId)}
      />

    </div>
  );
}
