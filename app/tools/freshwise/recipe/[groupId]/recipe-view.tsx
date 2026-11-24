"use client";

import Link from "next/link";
import { ItemRow } from "@/components/freshwise/item-row";
import { IllustratedArt } from "@/components/freshwise/game-art";
import { FaIcon } from "@/components/freshwise/fa-icon";
import { Callout, EmptyState, Hint, ListCard, Note, Paper, SectionTitle, PageTitle } from "@/components/freshwise/ui";
import { useFreshwise } from "@/components/freshwise/store";
import { colors, copy, text } from "@/components/freshwise/theme";
import { entriesOfGroup, groupsSorted } from "@/lib/freshwise/basket";
import { itemOrPlaceholder } from "@/lib/freshwise/catalog";
import { basketCost, formatMoney, qtyInUnit, KG_PER_CATTY, unitShort } from "@/lib/freshwise/price";
import { toRow } from "@/lib/freshwise/search";
import { monthOf } from "@/lib/freshwise/dates";
import type { PriceBook } from "@/lib/freshwise/types";

/**
 * 一道菜的食譜。
 *
 * 版面由上而下回答三個問題，順序就是使用者站在攤位前的思考順序：
 *   1. 今天做這道菜要花多少錢、一份多少錢、一份多少熱量（最上面那張卡）
 *   2. 要買哪些、各買多少（食材清單，直接沿用菜籃的 ItemRow）
 *   3. 怎麼做（步驟）
 *
 * 金額與熱量刻意擺在一起：這個工具的主張是「買菜不要買貴」，而熱量是同一個決定的
 * 另一面——知道這一鍋 1,200 元、一份 480 大卡，才算真的知道自己煮了什麼。
 */
export function RecipeView({ today, book, groupId }: { today: string; book: PriceBook; groupId: string }) {
  const { prefs, basket, basketReady } = useFreshwise();
  const group = groupsSorted(basket).find((g) => g.id === groupId);
  const recipe = group?.recipe;
  const entries = group ? entriesOfGroup(basket, group.id) : [];
  const month = monthOf(today);

  const priced = entries.map((entry) => {
    const quote = book.quotes[entry.code];
    return { entry, quote, row: quote ? toRow(itemOrPlaceholder(entry.code), quote, month) : null };
  });
  const cost = basketCost(priced.filter((p) => p.quote).map((p) => ({ qtyCatty: p.entry.qtyCatty, priceKg: p.quote!.avgKg })));

  if (!basketReady) return <div className="fw-page"><Hint center>{copy.loading}</Hint></div>;
  if (!group) {
    return (
      <div className="fw-page">
        <PageTitle hanging>食譜</PageTitle>
        <EmptyState icon="book" title="找不到這道菜" description="它可能已經從菜籃裡移除了。" action={<Link href="/tools/freshwise/basket" className="fw-game-button">回到{copy.basket}</Link>} />
      </div>
    );
  }

  const servings = recipe?.servings ?? 0;
  const perServing = servings > 0 && cost.counted > 0 ? Math.round(cost.total / servings) : null;

  return (
    <div className="fw-page fw-recipe-page">
      <div className="flex items-center justify-between gap-2">
        <Link href="/tools/freshwise/basket" className="fw-back-link" aria-label={`回到${copy.basket}`}>
          <IllustratedArt src="/freshwise/ui-back.png" size={40} />
        </Link>
      </div>

      {/* ── 這道菜今天的成本與熱量 ───────────────────────── */}
      <ListCard strong className="fw-recipe-hero flex flex-col gap-1.5">
        <span className="fw-recipe-dish"><FaIcon icon={group.icon} size={56} /></span>
        <h1 className={text.pageTitle}>{group.name}</h1>
        <p>
          <span className={text.priceBig}>{cost.counted > 0 ? formatMoney(cost.total) : "—"}</span>
          <span className={`ml-1.5 ${text.meta}`}>元</span>
        </p>
        <Hint>
          {entries.length} 樣食材
          {recipe && `・${recipe.servings} 人份・約 ${recipe.minutes} 分鐘`}
        </Hint>
      </ListCard>

      {recipe && (
        <div className="fw-recipe-stats">
          <RecipeStat label="一份成本" value={perServing === null ? "—" : `${formatMoney(perServing)} 元`} />
          <RecipeStat label="一份熱量" value={recipe.kcalPerServing === null ? "—" : `${recipe.kcalPerServing} 大卡`} />
          <RecipeStat label="要花多久" value={`${recipe.minutes} 分鐘`} />
        </div>
      )}

      {/* 熱量算不出來的時候要說清楚為什麼，不要只留一個「—」讓人以為壞了。 */}
      {recipe && recipe.kcalPerServing === null && (
        <Callout icon="circle-info" size="sm">這道菜的熱量還沒有估算。食材的熱量資料要另外建，目前只有成本是從今天的行情算出來的。</Callout>
      )}

      {/* ── 食材 ───────────────────────────────────────── */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle leaf action={<Link href="/tools/freshwise/basket" className="fw-leaf-link">去{copy.basket}改 →</Link>}>要買的食材</SectionTitle>
        {priced.length === 0 ? (
          <EmptyState icon="basket-shopping" title="這道菜還沒有食材" description={`到${copy.basket}把要買的加進這個分類。`} />
        ) : (
          <Paper variant="list">
            {priced.map(({ entry, row }) =>
              row ? (
                <ItemRow
                  key={entry.id}
                  row={row}
                  unit={prefs.unit}
                  href={`/tools/freshwise/browse/${entry.code}`}
                  meta={entry.qtyCatty === null ? "還沒填份量" : `${qtyInUnit(entry.qtyCatty * KG_PER_CATTY, prefs.unit)} ${unitShort(prefs.unit)}`}
                />
              ) : (
                <div key={entry.id} className="fw-item-row">
                  <span className={`min-w-0 flex-1 ${text.body}`}>{itemOrPlaceholder(entry.code).name}</span>
                  <span className={text.meta}>今天沒有行情</span>
                </div>
              ),
            )}
          </Paper>
        )}
      </section>

      {/* ── 作法 ───────────────────────────────────────── */}
      <section className="flex flex-col gap-2.5">
        <SectionTitle leaf>怎麼做</SectionTitle>
        {!recipe ? (
          <EmptyState
            icon="book"
            title="這道菜還沒有食譜"
            description="可以自己寫，或用你自己的 API 金鑰讓它幫你生一份草稿。"
          />
        ) : (
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
        )}
      </section>

      {recipe?.tip && (
        <section className="flex flex-col gap-2.5">
          <SectionTitle leaf>小撇步</SectionTitle>
          <Paper variant="flush"><Note>{recipe.tip}</Note></Paper>
        </section>
      )}

      {/* 來源要標：AI 生的步驟與熱量跟自己寫的可信度不一樣，使用者有權知道。 */}
      {recipe && (
        <Note className="text-center">
          {recipe.source === "ai" ? "這份食譜是 AI 生成的草稿，份量與熱量僅供參考。" : "這份食譜是你自己寫的。"}
        </Note>
      )}
    </div>
  );
}

function RecipeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="fw-recipe-stat">
      <span className={text.meta} style={{ color: colors.muted }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
