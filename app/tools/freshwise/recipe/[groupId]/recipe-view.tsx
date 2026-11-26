"use client";

import { useState } from "react";
import Link from "next/link";
import { IllustratedArt } from "@/components/freshwise/game-art";
import { DISH_ICONS } from "@/components/freshwise/group-icons";
import { ItemIcon } from "@/components/freshwise/item-icon";
import { PriceListRow } from "@/components/freshwise/price-list-row";
import { BackRow as SharedBackRow, Callout, EmptyState, Hint, ListCard, Note, Paper, PrimaryButton, SectionTitle, SegmentedTabs, UNIT_TABS } from "@/components/freshwise/ui";
import { NotInBasketBadge } from "@/components/freshwise/badges";
import { GoTopButton } from "@/components/freshwise/go-top-button";
import { useFreshwise } from "@/components/freshwise/store";
import { copy, text } from "@/components/freshwise/theme";
import { addEntry, entriesOfGroup, groupsSorted, updateEntry, updateGroup } from "@/lib/freshwise/basket";
import { itemImage, itemOrPlaceholder } from "@/lib/freshwise/catalog";
import { formatMoney, KG_PER_CATTY } from "@/lib/freshwise/price";
import { recipeCost, recipeForGroup, ingredientQty, ingredientQuantityText, type RecipeIngredient, type RecipeUnit } from "@/lib/freshwise/recipes";
import type { PriceBook } from "@/lib/freshwise/types";

/** 人份選項。2 和 4 最常見，排在前面。 */
const RECIPE_UNIT_TABS: readonly { key: RecipeUnit; label: string }[] = [...UNIT_TABS, { key: "g", label: "公克" }];

const SERVING_OPTIONS = [1, 2, 3, 4, 6, 8].map((n) => ({ key: String(n), label: `${n} 人` }));

/**
 * 一道菜的食譜。
 *
 * 版面由上而下回答三個問題，順序就是使用者站在攤位前的思考順序：
 *   1. 這道菜今天大概要花多少錢、幾人份
 *   2. 要買哪些、各買多少（分「主食材」與「另外準備」兩區）
 *   3. 怎麼做
 *
 * **食譜是固定的、不能改**（lib/freshwise/recipes.ts）。使用者的菜籃是他自己的，
 * 兩者刻意不互相覆蓋——食譜說「這道菜 2 人份要 0.25 台斤白蝦」，使用者可能寫
 * 「我每次都買 1 台斤」。兩個數字都對，意思不同，所以並排顯示，要不要套用由他決定。
 */
export function RecipeView({ book, groupId }: { book: PriceBook; groupId: string }) {
  const { basket, basketReady, setBasket, toast } = useFreshwise();
  const group = groupsSorted(basket).find((g) => g.id === groupId);
  const recipe = group ? recipeForGroup(group) : undefined;
  const [busy, setBusy] = useState(false);
  const [recipeUnit, setRecipeUnit] = useState<RecipeUnit>("g");

  if (!basketReady) return <div className="fw-page"><Hint center>{copy.loading}</Hint></div>;
  if (!group || !recipe) {
    return (
      <div className="fw-page">
        <BackRow unit={recipeUnit} onUnitChange={setRecipeUnit} />
        <EmptyState
          icon="book"
          title={group ? "這道菜還沒有食譜" : "找不到這個分類"}
          description={group ? "食譜還在陸續補上，之後回來看看。" : "它可能已經從菜籃裡移除了。"}
          action={<Link href="/tools/freshwise/basket" className="fw-game-button">回到{copy.basket}</Link>}
        />
      </div>
    );
  }

  const servings = group.servings ?? recipe.baseServings;
  const entries = entriesOfGroup(basket, group.id);
  const priceOf = (code: string) => book.quotes[code]?.avgKg;
  const cost = recipeCost(recipe, servings, priceOf);
  const dishFile = DISH_ICONS.find((dish) => dish.icon === recipe.dish)?.file ?? "ui-basket.webp";

  /** 食譜要的這一樣，菜籃裡有沒有？ */
  const inBasket = (code: string | null) => (code ? entries.find((e) => e.code === code) : undefined);
  const missing = recipe.main.filter((ing) => ing.code && !inBasket(ing.code));
  // 「份量跟食譜不一樣」的那幾項。沒填份量的不算——那是還沒填，不是填得不一樣。
  const differs = recipe.main.filter((ing) => {
    const entry = inBasket(ing.code);
    const want = ingredientQty(ing, recipe, servings);
    return entry && entry.qtyCatty !== null && want !== null && Math.abs(entry.qtyCatty - want) > 0.01;
  });

  function setServings(n: number) {
    if (!group) return;
    setBasket(updateGroup(basket, group.id, { servings: n }));
  }

  /**
   * 把食譜裡菜籃還沒有的主食材加進這個分類，**不動已經有的那幾項**。
   *
   * 新加的直接帶入食譜的份量——這一項原本不存在，所以不算覆蓋任何人填的東西。
   * 本來是加成空份量，結果新加的那幾項既不在「缺的」也不在「份量不一樣」裡
   * （後者只看已經填過數字的），使用者按完補齊之後沒有任何按鈕能幫他填份量。
   */
  function addMissing() {
    if (!group || busy) return;
    setBusy(true);
    let next = basket;
    for (const ing of missing) {
      if (!ing.code) continue;
      next = addEntry(next, group.id, ing.code, ingredientQty(ing, recipe!, servings) ?? null);
    }
    setBasket(next);
    toast(`已加入 ${missing.length} 樣食材`);
    setBusy(false);
  }

  /** 把份量改成食譜的量。**這會覆蓋使用者自己填的數字**，所以跟「補食材」分成兩顆
   *  按鈕——想補齊卻被改掉常買份量，會很惱人。 */
  function applyQuantities() {
    if (!group || busy) return;
    setBusy(true);
    let next = basket;
    for (const ing of recipe!.main) {
      const entry = inBasket(ing.code);
      const want = ingredientQty(ing, recipe!, servings);
      if (!entry || want === null) continue;
      next = updateEntry(next, entry.id, { qtyCatty: want });
    }
    setBasket(next);
    toast("份量已改成食譜的量");
    setBusy(false);
  }

  return (
    <div className="fw-page fw-recipe-page">
      <BackRow unit={recipeUnit} onUnitChange={setRecipeUnit} />

      {/* ── 料理與所需時間 ───────────────────────── */}
      <ListCard strong className="fw-recipe-hero">
        <span className="fw-recipe-dish"><IllustratedArt src={`/freshwise/${dishFile}`} size={80} /></span>
        <div className="min-w-0 flex-1">
        <h1 className={text.pageTitle}>{recipe.name}</h1>
        <Hint>
          {servings} 人份・約 {recipe.minutes} 分鐘
          {cost.skipped > 0 && `・${cost.skipped} 樣沒有行情`}
        </Hint>
        </div>
      </ListCard>

      {/* 人份是使用者唯一能改的東西，所以擺在最顯眼的地方。 */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle leaf>要煮幾人份</SectionTitle>
        <SegmentedTabs items={SERVING_OPTIONS} value={String(servings)} onChange={(v) => setServings(Number(v))} />
      </section>

      {/* ── 主食材 ──────────────────────────────────────── */}
      <section className="flex flex-col gap-2.5">
        {/* 標題右邊的金額跟行情頁的「共 N 項 · 元/公斤」用同一個字級與顏色（text.hint）：
            它是這一區的附註，不是這一頁的主角——每一列自己的金額才是要被讀的數字。 */}
        <SectionTitle leaf action={<span className={text.hint} aria-live="polite">{cost.counted > 0 ? `約 ${formatMoney(cost.total)} 元` : "暫無行情"}</span>}>主食材</SectionTitle>
        <Paper variant="list">
          {recipe.main.map((ing, i) => (
            <IngredientRow
              key={i}
              ing={ing}
              quantityLabel={ingredientQuantityText(ing, recipe, servings, recipeUnit)}
              qtyCatty={ingredientQty(ing, recipe, servings)}
              priceKg={ing.code ? priceOf(ing.code) : undefined}
              inBasket={!!inBasket(ing.code)}
            />
          ))}
        </Paper>

        {/* 兩顆按鈕刻意分開：補食材只是新增，改份量會覆蓋使用者自己填的數字。 */}
        {(missing.length > 0 || differs.length > 0) && (
          <div className="fw-recipe-actions">
            {missing.length > 0 && (
              <PrimaryButton size="block" icon="plus" disabled={busy} onClick={addMissing}>
                把缺的 {missing.length} 樣加進{copy.basket}
              </PrimaryButton>
            )}
            {/* 「改用」是關鍵字：這顆會覆蓋使用者自己在菜籃填的常買份量，文案短但不能
                短到看起來只是「填上去」。 */}
            {differs.length > 0 && (
              <button type="button" className="fw-leaf-link" disabled={busy} onClick={applyQuantities}>
                {differs.length} 樣份量改用食譜的量 →
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── 另外準備 ────────────────────────────────────── */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle leaf>另外準備</SectionTitle>
        <Paper variant="flush" className="fw-recipe-extra">
          {recipe.extra.map((ing, i) => (
            <div key={i} className="fw-recipe-extra-row">
              <span className={`min-w-0 flex-1 ${text.body}`}>{ing.name}</span>
              <span className={text.meta}>{ingredientQuantityText(ing, recipe, servings, recipeUnit)}</span>
            </div>
          ))}
        </Paper>
      </section>

      {/* ── 作法 ───────────────────────────────────────── */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle leaf>怎麼做</SectionTitle>
        <Paper variant="flush" className="fw-recipe-steps">
          <ol>
            {recipe.steps.map((step, i) => (
              <li key={i}>
                <span className="fw-recipe-step-no">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </Paper>
      </section>

      {recipe.tip && (
        <section className="flex flex-col gap-2.5">
          <SectionTitle leaf>小撇步</SectionTitle>
          <Paper variant="flush"><Note>{recipe.tip}</Note></Paper>
        </section>
      )}

      <Callout icon="circle-info" size="sm">
        金額是用今天的行情 × 食譜份量估的，跟你在{copy.basket}填的常買份量是分開的兩件事。
      </Callout>

      {/* 食譜頁一定比一螢幕長（食材兩區＋作法＋小撇步），所以不用像清單頁那樣先數長度。 */}
      <GoTopButton visible />
    </div>
  );
}

function BackRow({ unit, onUnitChange }: { unit: RecipeUnit; onUnitChange: (unit: RecipeUnit) => void }) {
  return (
    <SharedBackRow href="/tools/freshwise/basket" label={`回到${copy.basket}`}>
      <SegmentedTabs items={RECIPE_UNIT_TABS} value={unit} onChange={onUnitChange} />
    </SharedBackRow>
  );
}

/**
 * 食譜的一樣食材。
 *
 * 右邊顯示的是**這道菜要用掉多少錢**（份量 × 今天的單價），不是「一台斤多少錢」——
 * 使用者要的是「這道菜多少錢」，不是查單價（那在行情頁）。
 */
function IngredientRow({
  ing, quantityLabel, qtyCatty, priceKg, inBasket,
}: {
  ing: RecipeIngredient;
  quantityLabel: string;
  qtyCatty: number | null;
  priceKg?: number;
  inBasket: boolean;
}) {
  const item = ing.code ? itemOrPlaceholder(ing.code) : null;
  const name = ing.name ?? item?.name ?? "";
  const money = qtyCatty !== null && priceKg !== undefined ? Math.round(qtyCatty * KG_PER_CATTY * priceKg) : null;
  // 沒有代碼的主食材（板豆腐、油麵、米粉、豬腰…）不是「今天剛好沒報價」，是**這樣東西
  // 根本沒有公開行情**（見 catalog.ts 的 PANTRY）。所以：
  //   - 不掛「不在菜籃」徽章——它永遠進不了菜籃，那個徽章只會讓人去找一顆按不了的按鈕
  //   - 金額那一欄寫「無行情」，不是「—」。「—」看起來像資料還沒載好
  const priceless = !ing.code;
  return <PriceListRow
    art={ing.code && <ItemIcon src={itemImage(ing.code)} alt={name} size={40} />}
    title={name}
    badges={ing.code && !inBasket && <NotInBasketBadge size="sm" />}
    meta={quantityLabel}
    // 價格欄顯示的是「這道菜要用掉多少錢」，所以是算好的金額不是單價——PriceText 是
    // 「每單位多少錢」的元件，這裡用不上，但字級與對齊要跟它一致（.fw-recipe-money）。
    price={money === null ? <span className={text.meta}>{priceless ? "無行情" : "—"}</span> : <span className="fw-recipe-money">{formatMoney(money)} 元</span>}
    href={ing.code ? `/tools/freshwise/browse/${ing.code}` : undefined}
  />;
}
