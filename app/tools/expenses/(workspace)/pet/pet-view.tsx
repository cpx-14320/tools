"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/expenses/page-header";
import { Card, CardBody } from "@/components/expenses/card";
import { PillButton } from "@/components/expenses/button";
import { ListCard, ListRow } from "@/components/expenses/list-row";
import { Modal } from "@/components/expenses/modal";
import { ProgressBar } from "@/components/expenses/progress-bar";
import { PetSprite, type PetMood } from "@/components/expenses/pet-sprite";
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
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountTypeDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
  const [transfers, setTransfers] = useState<TransferDTO[]>([]);
  const [ready, setReady] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [mood, setMood] = useState<PetMood>("idle");
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

  async function act(action: "feed" | "buy" | "equip", itemId: string) {
    const res = await fetch("/api/expenses/pet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, itemId }),
    }).catch(() => null);
    const data: { pet?: PetState; error?: string } = (await res?.json().catch(() => ({}))) ?? {};
    if (data.error) {
      setMessage(data.error);
      return;
    }
    if (data.pet) {
      setPet(data.pet);
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

  if (!ready) {
    return (
      <div>
        <PageHeader title="養成" />
        <p className={text.faint}>載入中…</p>
      </div>
    );
  }

  const level = levelFromXp(pet?.xp ?? 0);
  const net = netWorth(accounts, accountTypes, transactions, categories, transfers);
  const tier = wealthTier(net);
  const outfit = petItemById(pet?.outfitId ?? "");

  return (
    <div>
      <PageHeader title="養成" description="好好記帳就能賺星星幣，拿去餵角色、換衣服" />

      {/* 角色場地：待機會呼吸，按「散步」會沿著場地走來走去、碰到邊緣自己轉身。 */}
      <Card className="mb-4">
        <CardBody>
          <div className="rounded-2xl px-3 pt-4" style={{ background: petBackground(pet?.backgroundId ?? "") }}>
            <PetSprite mood={mood} hueRotate={outfit?.hueRotate ?? 0} size={168} />
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className={text.sectionHeading}>Lv.{level.level}</p>
              <p className={text.muted}>
                {tier.name}・淨資產 {formatCurrency(net)}
              </p>
            </div>
            <PillButton onClick={() => setMood((m) => (m === "walking" ? "idle" : "walking"))} active={mood === "walking"}>
              {mood === "walking" ? "休息一下" : "散步"}
            </PillButton>
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

      {/* 賺幣規則收進彈窗，比照首頁「vs 去年同期」那顆比較基準按鈕——平常只留一顆
          小按鈕，頁面才不會被說明文字占掉版面，想看的人自己點開。 */}
      <div className="flex justify-center">
        <PillButton onClick={() => setRulesOpen(true)}>
          <span aria-hidden>❓</span> 怎麼賺星星幣
        </PillButton>
      </div>

      <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title="怎麼賺星星幣">
        <ListCard>
          <ListRow name="當天有記帳" right={<span className="text-xs font-semibold tabular-nums text-[#6F5FD6]">⭐ {DAILY_LOG_COINS}</span>} />
          <ListRow name="連續記帳 3／7／14／30 天" right={<span className="text-xs font-semibold tabular-nums text-[#6F5FD6]">⭐ 10～100</span>} />
          <ListRow name="上個月每個分類都沒超支" right={<span className="text-xs font-semibold tabular-nums text-[#6F5FD6]">⭐ {BUDGET_KEPT_COINS}</span>} />
        </ListCard>
        <p className={`${text.faint} leading-relaxed`}>
          星星幣只看記帳習慣，不看你有多少錢——淨資產只拿來算上面那個理財段位，才不會因為一筆大額支出就讓角色跟著「變窮」。
        </p>
      </Modal>
    </div>
  );
}
