"use client";

import { useEffect, useState } from "react";
import { useSkeletonReady } from "@/components/expenses/skeleton-count";
import { PageHeader } from "@/components/expenses/page-header";
import { CardSkeleton, SkeletonBar } from "@/components/expenses/skeleton";
import { Card, CardBody } from "@/components/expenses/card";
import { ListCard, ListRow } from "@/components/expenses/list-row";
import { ProgressBar } from "@/components/expenses/progress-bar";
import { PetSprite, petStage, PET_EATING_MS, type PetMood } from "@/components/expenses/pet-sprite";
import { PetShopModal } from "@/components/expenses/pet-shop";
import { IconImg } from "@/components/expenses/icon-img";
import { text } from "@/components/expenses/theme";
import { DAILY_LOG_COINS, BUDGET_KEPT_COINS, PET_ITEMS, levelFromXp, petBackground, petItemById, wealthTier } from "@/lib/expenses/pet";
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
  justEarned: { key: string; coins: number; label: string }[];
}

export function PetView() {
  const [pet, setPet] = useState<PetState | null>(null);
  const skeletonReady = useSkeletonReady();
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [transfers, setTransfers] = useState<TransferDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
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
  // 不擋的話會先閃一次錯的列數再換成記住的（見 useSkeletonReady）。
  if (!skeletonReady) return null;

  if (!ready) {
    // 這一頁的版面是固定的（角色場地、食物背包、商店入口三張卡），不像清單頁會隨
    // 筆數變長，所以骨架直接把那三張卡的形狀畫出來，載入前後的高度就一樣。
    return (
      <div>
        <PageHeader title="養成" />
        <CardSkeleton className="mb-4">
          <div className="h-40 w-full animate-pulse rounded-2xl bg-[#EDE6FB]" />
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

        <CardSkeleton className="mb-4">
          <div className="flex items-center justify-between gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1 py-1">
                <div className="size-10 animate-pulse rounded-xl bg-[#EDE6FB]" />
                <SkeletonBar width={56} height={11} />
              </div>
            ))}
          </div>
        </CardSkeleton>

        <CardSkeleton>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-11 animate-pulse rounded-2xl bg-[#EDE6FB]" />
              <div>
                <SkeletonBar width={40} height={14} />
                <SkeletonBar width={128} height={12} className="mt-1.5" />
              </div>
            </div>
            <SkeletonBar width={48} height={14} />
          </div>
        </CardSkeleton>
      </div>
    );
  }

  const level = levelFromXp(pet?.xp ?? 0);
  const net = netWorth(accounts, accountTypes, transactions, categories, transfers);
  const tier = wealthTier(net);
  const outfit = petItemById(pet?.outfitId ?? "");

  return (
    <div>
      {/* 說明跟賺幣規則都收在標題右邊的問號裡（PageHeader 的 help），跟記帳本其他頁一致。 */}
      <PageHeader
        title="養成"
        help={
          <>
            <p className={`${text.muted} leading-relaxed`}>好好記帳就能賺星星幣，拿去餵角色、換衣服。</p>
            <p className={text.sectionHeading}>怎麼賺星星幣</p>
            <ListCard>
              <ListRow name="當天有記帳" right={<span className="text-xs font-semibold tabular-nums text-[#6F5FD6]">⭐ {DAILY_LOG_COINS}</span>} />
              <ListRow name="連續記帳 3／7／14／30 天" right={<span className="text-xs font-semibold tabular-nums text-[#6F5FD6]">⭐ 10～100</span>} />
              <ListRow name="上個月每個分類都沒超支" right={<span className="text-xs font-semibold tabular-nums text-[#6F5FD6]">⭐ {BUDGET_KEPT_COINS}</span>} />
            </ListCard>
            <p className={`${text.faint} leading-relaxed`}>
              星星幣只看記帳習慣，不看你有多少錢——淨資產只拿來算上面那個理財段位，才不會因為一筆大額支出就讓角色跟著「變窮」。
            </p>
          </>
        }
      />

      {/* 角色場地：平常待機呼吸，餵食時切成吃東西的動畫、跑完一輪自己回到待機。 */}
      <Card className="mb-4">
        <CardBody>
          {/* 場地高度固定，角色置中；換背景、換裝都只是換這塊的底色跟角色色相，版面
              不會跟著變動。角色本身是固定 110px（見 PetSprite 的 size），所以場地不用
              跟著螢幕寬度長成一個很大的正方形——那只會在角色四周留一大片空白。 */}
          <div className="grid h-40 w-full place-items-center rounded-2xl p-3" style={{ background: petBackground(pet?.backgroundId ?? "") }}>
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

      {message && (
        <button type="button" onClick={() => setMessage(null)} className="mb-4 w-full rounded-2xl bg-[#F3EFFC] px-4 py-3 text-left text-xs text-[#4A3B7C]">
          {message}
          <span className={`ml-1 ${text.faint}`}>（點一下關閉）</span>
        </button>
      )}

      {/* 食物背包——固定顯示三種食物的持有數量，直接點了就吃（消耗一份、換成經驗值）。
          在商店買的食物進的是這裡，不是點了商店格子就直接吃掉；兩個動作分開。 */}
      <Card className="mb-4">
        <CardBody className="flex items-center justify-between gap-2">
          {PET_ITEMS.filter((i) => i.kind === "食物").map((item) => {
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

      {/* 商店入口——真正的格狀選購版面放在彈窗裡（PetShopModal），這裡只是一個
          像手遊「進商店」的入口列，平常不佔版面。 */}
      <button type="button" onClick={() => setShopOpen(true)} className="mb-4 w-full">
        <Card>
          <CardBody className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-[#F3EFFC] text-xl">🛍️</span>
              <div className="text-left">
                <p className={text.sectionHeading}>商店</p>
                <p className={text.muted}>用星星幣買食物、換衣服</p>
              </div>
            </div>
            <span className="flex items-center gap-1 text-sm font-semibold tabular-nums text-[#6F5FD6]">
              ⭐ {pet?.coins ?? 0}
              <span aria-hidden className="text-[#C7BFE6]">
                ›
              </span>
            </span>
          </CardBody>
        </Card>
      </button>

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

    </div>
  );
}
