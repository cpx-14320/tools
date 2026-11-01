"use client";

import { useEffect, useState } from "react";
import { useSkeletonVisible } from "@/components/expenses/skeleton-count";
import { PageHeader } from "@/components/expenses/page-header";
import { CardSkeleton, SkeletonBar } from "@/components/expenses/skeleton";
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
  /** 最近七天哪幾天簽到過，由舊到新，最後一個是今天。 */
  signinRecentDays: boolean[];
  justEarned: { key: string; coins: number; label: string }[];
}

/** 疊在場地右上角的小圖示鈕（商店、背包）。半透明白底＋毛玻璃，不管背景換成哪一張
 *  都看得見；尺寸比照日期旁邊那排圖示鈕（32px）。 */
function StageIconButton({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-9 place-items-center rounded-full bg-white/85 shadow-sm backdrop-blur transition-opacity hover:opacity-90"
    >
      <IconImg src={icon} alt={label} size={20} background={false} />
    </button>
  );
}

/** 食物背包／商店的食物清單——骨架跟真畫面都用同一份，格數才不會對不上。 */
const FOOD_ITEMS = PET_ITEMS.filter((i) => i.kind === "食物");

export function PetView() {
  const [pet, setPet] = useState<PetState | null>(null);
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [transfers, setTransfers] = useState<TransferDTO[]>([]);
  const [ready, setReady] = useState(false);
  const showSkeleton = useSkeletonVisible(!ready);
  const [shopOpen, setShopOpen] = useState(false);
  const [bagOpen, setBagOpen] = useState(false);
  const [mood, setMood] = useState<PetMood>("idle");
  // 連續餵第二次時 mood 已經是 "eating"、setMood 等於沒變，下面那個計時器就不會重新
  // 計時，第二次的動畫會被第一次的計時器提早切掉。用這個每次遞增的數字當重新計時的依據。
  const [feedNonce, setFeedNonce] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  // 「今天」掛載時算一次固定住（本地日期，不是 UTC）——伺服器時區不一定跟使用者同一個，
  // 所以結算要看的「今天」由這邊決定。
  const [todayISO] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/expenses/pet?today=${todayISO}`).then((res) => res.json()),
      fetch("/api/expenses/accounts").then((res) => res.json()),
      fetch("/api/expenses/account-types").then((res) => res.json()),
      fetch("/api/expenses/categories").then((res) => res.json()),
      fetch("/api/expenses/transactions").then((res) => res.json()),
      fetch("/api/expenses/transfers").then((res) => res.json()),
    ])
      .then(
        ([petData, accountsData, typesData, catData, txData, transfersData]: [
          { pet?: PetState },
          { accounts?: AccountDTO[] },
          { accountTypes?: AccountTypeDTO[] },
          { categories?: CategoryDTO[] },
          { transactions?: TransactionDTO[] },
          { transfers?: TransferDTO[] },
        ]) => {
          if (cancelled) return;
          setPet(petData.pet ?? null);
          setAccounts(accountsData.accounts ?? []);
          setAccountTypes(typesData.accountTypes ?? []);
          setCategories(catData.categories ?? []);
          setTransactions(txData.transactions ?? []);
          setTransfers(transfersData.transfers ?? []);
          if (petData.pet?.justEarned?.length) {
            setMessage(`獲得 ${petData.pet.justEarned.reduce((s, r) => s + r.coins, 0)} 顆星星幣：${petData.pet.justEarned.map((r) => r.label).join("、")}`);
          }
          setReady(true);
        },
      )
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [todayISO]);

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

  // 骨架等掛載後才畫：列數只有瀏覽器讀得到，伺服器端畫出來的一定是預設值，
  // 不擋的話會先閃一次錯的列數再換成記住的（見 useSkeletonVisible）。
  if (!ready) {
    if (!showSkeleton) return null;
    // 這一頁的版面是固定的（角色場地、簽到、食物背包三張卡），不像清單頁會隨筆數
    // 變長，所以骨架直接把那三張卡的形狀畫出來，載入前後的高度就一樣。
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="養成" flush />
        <CardSkeleton>
          {/* 骨架跟著場地的 16:9 走（見下面的 aspect-[16/9]）。 */}
          <div className="aspect-[16/9] w-full animate-pulse rounded-2xl bg-[#EDE6FB]" />
          <div className="mt-3">
            <SkeletonBar width={56} height={14} />
            <SkeletonBar width={140} height={12} className="mt-1.5" />
          </div>
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <SkeletonBar width={40} height={12} />
              <SkeletonBar width={48} height={12} />
            </div>
            <SkeletonBar width="100%" height={8} />
          </div>
        </CardSkeleton>

        {/* 簽到卡：標題＋今天拿多少一排、說明一行、底下七個格子。 */}
        <CardSkeleton>
          <div className="flex items-center justify-between gap-2">
            <SkeletonBar width={64} height={20} />
            <SkeletonBar width={72} height={16} />
          </div>
          <div className="mt-0.5">
            <SkeletonBar width={180} height={16} />
          </div>
          <div className="mt-3 flex gap-1.5">
            {Array.from({ length: SIGNIN_STREAK_CAP }, (_, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="h-8 w-full animate-pulse rounded-xl bg-[#EDE6FB]" />
                <SkeletonBar width={28} height={12} />
              </div>
            ))}
          </div>
        </CardSkeleton>

        <CardSkeleton>
          {/* 格數直接數 PET_ITEMS 裡的食物有幾種，不要寫死 3：之後多加一種食物時，
              骨架會自己跟上，不會變成「載入時三格、載完四格」。 */}
          <div className="flex items-center justify-between gap-2">
            {FOOD_ITEMS.map((item) => (
              <div key={item.id} className="flex flex-1 flex-col items-center gap-1 py-1">
                <div className="size-10 animate-pulse rounded-xl bg-[#EDE6FB]" />
                <SkeletonBar width={56} height={11} />
              </div>
            ))}
          </div>
        </CardSkeleton>

      </div>
    );
  }

  const level = levelFromXp(pet?.xp ?? 0);
  const net = netWorth(accounts, accountTypes, transactions, categories, transfers);
  const tier = wealthTier(net);
  // 簽到是進頁面就自動結算的，所以 signinStreak > 0 就代表今天已經簽到了。
  const streak = pet?.signinStreak ?? 0;
  const signedInToday = streak > 0;
  const recentDays = pet?.signinRecentDays ?? [];
  const outfit = petItemById(pet?.outfitId ?? "");

  return (
    <div className="flex flex-col gap-4">
      {/* 說明跟賺幣規則都收在標題右邊的問號裡（PageHeader 的 help），跟記帳本其他頁一致。 */}
      <PageHeader
        title="養成"
        help={
          <>
            <p className={`${text.muted} leading-relaxed`}>好好記帳就能賺星星幣，拿去餵角色、換衣服。</p>
            <p className={text.sectionHeading}>怎麼賺星星幣</p>
            <ListCard>
              <ListRow name="每日簽到（打開記帳本就算）" right={<span className="text-xs font-semibold tabular-nums text-[#6F5FD6]">⭐ {signinCoins(1)}</span>} />
              <ListRow
                name={`連續簽到第 2～${SIGNIN_STREAK_CAP} 天`}
                right={
                  <span className="text-xs font-semibold tabular-nums text-[#6F5FD6]">
                    ⭐ {signinCoins(2)}～{signinCoins(SIGNIN_STREAK_CAP)}
                  </span>
                }
              />
              <ListRow name="每記一筆帳" right={<span className="text-xs font-semibold tabular-nums text-[#6F5FD6]">⭐ {ENTRY_COINS}</span>} />
              <ListRow name="上個月每個分類都沒超支" right={<span className="text-xs font-semibold tabular-nums text-[#6F5FD6]">⭐ {BUDGET_KEPT_COINS}</span>} />
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
            className="relative grid aspect-[16/9] w-full place-items-center rounded-2xl p-3"
            style={{ background: petBackground(pet?.backgroundId ?? "") }}
          >
            <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 text-sm font-semibold tabular-nums text-[#6F5FD6] backdrop-blur">
              ⭐ {pet?.coins ?? 0}
            </span>
            <span className="absolute right-3 top-3 flex flex-col gap-2">
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

      {/* 簽到：進這一頁就自動簽到（見 settlePetRewards），所以這一塊是「結果」不是
          「按鈕」——它要回答的是「我連幾天了、今天拿到多少、明天會拿多少」。 */}
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
          {/* 一天一格，由舊到新，最後一格是今天。簽到過的填滿、沒簽的留空——斷掉的那
              幾天看得見，才知道連續是怎麼斷的。 */}
          <div className="mt-3 flex gap-1.5">
            {recentDays.map((done: boolean, i: number) => {
              const isToday = i === recentDays.length - 1;
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <span
                    className={`grid h-8 w-full place-items-center rounded-xl text-[11px] font-semibold tabular-nums ${
                      done ? "bg-[#6F5ED4] text-white" : "bg-[#F3EFFC] text-[#C7BFE6]"
                    }`}
                  >
                    {done ? "⭐" : ""}
                  </span>
                  <span className={`text-[10px] ${isToday ? "font-semibold text-[#6F5FD6]" : text.faint}`}>{isToday ? "今天" : `${recentDays.length - 1 - i} 天前`}</span>
                </div>
              );
            })}
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
