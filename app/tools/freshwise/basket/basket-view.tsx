"use client";

import { useMemo, useState } from "react";
import { useCompanion } from "@/components/freshwise/companion-store";
import { PetArtwork } from "@/components/freshwise/game-art";
import { QuestSlip } from "@/components/freshwise/companion-widgets";
import { newlyFilledQuantity } from "@/lib/freshwise/companions";
import {
  AddButton,
  CollapsibleList,
  Callout,
  DragHandle,
  EmptyState,
  Hint,
  IconButton,
  ListCard,
  Note,
  PageTitle,
  PrimaryButton,
  SectionTitle,
} from "@/components/freshwise/ui";
import { FaIcon } from "@/components/freshwise/fa-icon";
import { ItemRow } from "@/components/freshwise/item-row";
import { PriceListRow } from "@/components/freshwise/price-list-row";
import { ItemIcon } from "@/components/freshwise/item-icon";
import { GoTopButton } from "@/components/freshwise/go-top-button";
import { ItemPickerModal } from "@/components/freshwise/item-picker-modal";
import { EntryEditorSheet, GroupEditorSheet } from "@/components/freshwise/basket-sheets";
import { useFreshwise } from "@/components/freshwise/store";
import { colors, copy, text } from "@/components/freshwise/theme";
import { moveItem, useDragReorder } from "@/components/freshwise/use-drag-reorder";
import {
  addEntry,
  addGroup,
  deleteGroup,
  entriesOfGroup,
  groupsSorted,
  removeEntry,
  reorderEntries,
  reorderGroups,
  updateEntry,
  updateGroup,
} from "@/lib/freshwise/basket";
import { itemImage, itemOrPlaceholder, venueMeta } from "@/lib/freshwise/catalog";
import { formatShortDate, monthOf } from "@/lib/freshwise/dates";
import { basketCost, entryCost, formatMoney, unitShort } from "@/lib/freshwise/price";
import { toRow } from "@/lib/freshwise/search";
import type { BasketEntry, BasketGroup, PriceBook, PriceQuote, UnitKey } from "@/lib/freshwise/types";

export function BasketView({ today, book }: { today: string; book: PriceBook }) {
  const { prefs, basketReady, basket, setBasket, toast } = useFreshwise();
  const { record, state: companion } = useCompanion();
  const month = monthOf(today);

  // 開著哪一個彈窗。三個彈窗（分類編輯、項目編輯、品項選擇）各自需要知道「在哪個分類
  // 上操作」，所以存的是目標本身而不只是一個 boolean。
  const [groupEditing, setGroupEditing] = useState<BasketGroup | "new" | null>(null);
  const [entryEditing, setEntryEditing] = useState<BasketEntry | null>(null);
  const [pickerGroupId, setPickerGroupId] = useState<string | null>(null);

  const groups = groupsSorted(basket);

  /** 菜籃裡每個品項今天的行情。價格是伺服器端算好、整本價格簿傳下來的（book.quotes），
   *  這裡只是把菜籃裡用到的那幾個挑出來。挑不到代表那個品項今天在這個場所沒有行情
   *  （產季外、或這個市場沒進貨），那一列就不畫。 */
  const quotes = useMemo(() => {
    const map = new Map<string, PriceQuote>();
    for (const entry of basket.entries) {
      const quote = book.quotes[entry.code];
      if (quote && !map.has(entry.code)) map.set(entry.code, quote);
    }
    return map;
  }, [basket.entries, book.quotes]);

  /** 整籃的估算金額。只算有填份量的項目，沒填的另外提示有幾項（不要自己假設份量，
   *  那會讓總額看起來是精算過的）。 */
  const cost = useMemo(
    () =>
      basketCost(
        basket.entries.filter((entry) => quotes.has(entry.code)).map((entry) => ({ qtyCatty: entry.qtyCatty, priceKg: quotes.get(entry.code)!.avgKg })),
      ),
    [basket.entries, quotes],
  );

  // ── 分類的拖曳排序 ───────────────────────────────────────
  const groupDrag = useDragReorder(
    groups.length,
    (from, to) => setBasket(reorderGroups(basket, moveItem(groups, from, to).map((g) => g.id))),
    () => toast("順序已更新"),
  );

  return (
    <div className="fw-page fw-basket-page">
      <PageTitle hanging>{copy.basket}</PageTitle>

      {/* 這一籃今天大概要花多少錢。這是菜籃頁存在的理由——分開看每一樣菜多少錢沒有感覺，
          加起來的數字才有。 */}
      <ListCard strong className="fw-basket-summary flex flex-col gap-1.5">
        {/* 夥伴要跟著使用者選的那一隻，不要寫死。 */}
        <PetArtwork id={companion.active} size={100} className="fw-basket-pet" />
        {/* 三行就夠：標題、金額、條件。以前右欄把場所／日期／項目數拆成三行，加上左欄
            兩行、底下再兩行註解，一張卡片六七行文字，重點（金額）反而不突出。場所、
            單位、日期、項目數都是同一件事的條件，併成一行用「・」分隔。 */}
        <Hint>今天買整籃大概要</Hint>
        <p>
          <span className={text.priceBig}>{cost.counted > 0 ? formatMoney(cost.total) : "—"}</span>
          <span className={`ml-1.5 ${text.meta}`}>元</span>
        </p>
        <Hint>
          {venueMeta(prefs.venue).name}・{unitShort(prefs.unit)}價・{formatShortDate(book.dataDate)}・{basket.entries.length} 項
          {cost.skipped > 0 && `（${cost.skipped} 項沒填份量）`}
        </Hint>
        {cost.counted === 0 ? (
          <Note>幫項目填上常買的份量（例如 2 {unitShort("catty")}），這裡就會估算整籃的金額。</Note>
        ) : (
          basketReady && basket.entries.some((entry) => !quotes.has(entry.code)) && <Note>估算值；沒有行情的項目不計入總額。</Note>
        )}
      </ListCard>

      {/* ready 之前不要畫空狀態：localStorage 還沒讀完，這時候 basket 是預設值，先閃一次
          「菜籃是空的」再跳出一堆項目會很突兀。 */}
      {!basketReady ? (
        <Hint center>{copy.loading}</Hint>
      ) : groups.length === 0 ? (
        <EmptyState
          icon="basket-shopping"
          title={`還沒有任何${copy.group}`}
          description="先建一個分類（例如「每週常買」），再把常買的菜放進去。"
          action={<PrimaryButton icon="plus" onClick={() => setGroupEditing("new")}>{`新增${copy.group}`}</PrimaryButton>}
        />
      ) : (
        groups.map((group, groupIndex) => {
          const entries = entriesOfGroup(basket, group.id).sort((a,b) => Number(quotes.has(b.code)) - Number(quotes.has(a.code)));
          return (
            <section
              key={group.id}
              ref={groupDrag.rowRef(groupIndex)}
              className={`flex flex-col gap-2.5 ${groupDrag.rowClass(groupIndex)}`}
            >
              <SectionTitle
                action={
                  <span className="flex items-center gap-1">
                    <IconButton icon="pen" iconSize={32} aria-label={`編輯${group.name}`} onClick={() => setGroupEditing(group)} />
                    {/* 只有兩個以上的分類才給握把——只有一個的時候拖曳沒有意義。 */}

                  </span>
                }
              >
                <span className="flex items-center gap-1.5">
                  {groups.length > 1 && <DragHandle label={`拖曳排序 ${group.name}`} {...groupDrag.handleProps(groupIndex)} />}
                  <FaIcon icon={group.icon} size={40} color={colors.brand} />
                  {group.name}
                  <span className={text.meta}>{entries.length} 項</span>
                </span>
              </SectionTitle>

              <GroupEntries
                entries={entries}
                month={month}
                unit={prefs.unit}
                quotes={quotes}
                onEdit={setEntryEditing}
                onAdd={() => setPickerGroupId(group.id)}
                onReorder={(orderedIds) => setBasket(reorderEntries(basket, group.id, orderedIds))}
                onReorderDone={() => toast("順序已更新")}
              />
            </section>
          );
        })
      )}

      <QuestSlip />
      <Callout icon="database">
        {copy.sourceNote}
      </Callout>

      <div aria-hidden="true" className={`fw-basket-floating-spacer ${basket.entries.length >= 8 ? "fw-basket-floating-spacer-double" : ""}`}/>
      <div className="fw-basket-floating-actions">
        <IconButton icon="plus" aria-label={`新增${copy.group}`} title={`新增${copy.group}`} aria-haspopup="dialog" disabled={!basketReady} onClick={() => setGroupEditing("new")}/>
        <GoTopButton visible={basket.entries.length >= 8} inline/>
      </div>

      {/* ── 彈窗 ──────────────────────────────────────────── */}
      <GroupEditorSheet
        open={groupEditing !== null}
        group={groupEditing && groupEditing !== "new" ? groupEditing : undefined}
        onClose={() => setGroupEditing(null)}
        onSave={(name, icon) => {
          if (groupEditing === "new") {
            setBasket(addGroup(basket, name, icon));
            toast(copy.created);
          } else if (groupEditing) {
            setBasket(updateGroup(basket, groupEditing.id, { name, icon }));
            toast(copy.saved);
          }
          setGroupEditing(null);
        }}
        onDelete={
          groupEditing && groupEditing !== "new"
            ? () => {
                setBasket(deleteGroup(basket, groupEditing.id));
                toast(copy.deleted);
                setGroupEditing(null);
              }
            : undefined
        }
      />

      <EntryEditorSheet
        open={entryEditing !== null}
        itemName={entryEditing ? itemOrPlaceholder(entryEditing.code).name : ""}
        qtyCatty={entryEditing?.qtyCatty ?? null}
        groupId={entryEditing?.groupId ?? ""}
        groups={groups}
        onClose={() => setEntryEditing(null)}
        onSave={(qtyCatty, groupId) => {
          if (entryEditing) {
            const next = updateEntry(basket, entryEditing.id, { qtyCatty, groupId });
            if (newlyFilledQuantity(basket.entries, next.entries) && book.quotes[entryEditing.code]) record({ type: "basket" });
            setBasket(next);
            toast(copy.saved);
          }
          setEntryEditing(null);
        }}
        onDelete={() => {
          if (entryEditing) {
            setBasket(removeEntry(basket, entryEditing.id));
            toast(copy.deleted);
          }
          setEntryEditing(null);
        }}
      />

      <ItemPickerModal
        open={pickerGroupId !== null}
        month={month}
        excludeCodes={pickerGroupId ? entriesOfGroup(basket, pickerGroupId).map((e) => e.code) : []}
        onClose={() => setPickerGroupId(null)}
        onPick={(code) => {
          if (pickerGroupId) {
            setBasket(addEntry(basket, pickerGroupId, code));
            toast(`${itemOrPlaceholder(code).name}${copy.addedToBasket}`);
          }
          setPickerGroupId(null);
        }}
      />
    </div>
  );
}

/**
 * 一個分類底下的項目清單（含這個分類自己的拖曳排序）。
 *
 * **一定要定義在 BasketView 外面。** 寫成內部函式的話，每次 BasketView 重新算繪都會產生
 * 一個新的元件型別，React 會把整個子樹卸載再重新掛載——拖曳中每移動一格就會 setState、
 * 跟著重新算繪，於是 useDragReorder 的狀態（正在拖第幾筆）每一格都被重設，pointer capture
 * 也跟著斷掉，實際症狀是「拖一下就彈回去、拖不動」。
 *
 * 另外，每個分類都需要一組獨立的拖曳狀態，所以這段不能直接寫在上面的 map 迴圈裡（hook
 * 的呼叫次數必須固定）——拆成元件剛好同時解決這件事。
 */
function GroupEntries({
  entries,
  month,
  unit,
  quotes,
  onEdit,
  onAdd,
  onReorder,
  onReorderDone,
}: {
  entries: BasketEntry[];
  month: number;
  unit: UnitKey;
  quotes: Map<string, PriceQuote>;
  onEdit: (entry: BasketEntry) => void;
  onAdd: () => void;
  onReorder: (orderedIds: string[]) => void;
  onReorderDone: () => void;
}) {
  const drag = useDragReorder(
    entries.length,
    (from, to) => onReorder(moveItem(entries, from, to).map((e) => e.id)),
    onReorderDone,
  );

  if (entries.length === 0) {
    return (
      <>
        <ListCard>
          <Hint center>
            這個{copy.group}還沒有{copy.entry}
          </Hint>
        </ListCard>
        <AddButton onClick={onAdd}>{`新增${copy.entry}`}</AddButton>
      </>
    );
  }

  return (
    <>
      {/* 分類裡的項目多的時候整頁會很長，跟首頁的清單用同一套收合。 */}
      <CollapsibleList moreLabel={(n) => `這個${copy.group}還有 ${n} 項，展開看`}>
      {entries.map((entry, index) => {
        const item = itemOrPlaceholder(entry.code);
        const quote = quotes.get(entry.code);
        // 今天沒有行情的項目（產季外、或這個市場沒進貨）照樣列出來、只是沒有價格——
        // 靜靜消失的話使用者會以為自己的菜籃被動過了。
        if (!quote) {
          return (
            // 沒有行情的項目一樣走 PriceListRow，只是價格欄放一個「—」。以前另外手刻
            // 一份排版，結果同一份清單裡有兩種列高與兩種字級。
            <div key={entry.id} ref={drag.rowRef(index)} className={drag.rowClass(index)}>
              <ListCard className="fw-basket-entry-card">
                <PriceListRow
                  art={<ItemIcon src={itemImage(item.code)} fallbackIcon={item.icon} alt={item.name} size={20} boxSize={40} className="opacity-60" />}
                  title={item.name}
                  meta="今天這個場所沒有行情"
                  price={<span className={text.hint}>—</span>}
                  leading={entries.length > 1 ? <DragHandle label={`拖曳排序 ${item.name}`} {...drag.handleProps(index)} /> : undefined}
                  onClick={() => onEdit(entry)}
                />
              </ListCard>
            </div>
          );
        }
        const row = toRow(item, quote, month);
        const costOfEntry = entryCost(entry.qtyCatty, quote.avgKg);
        return (
          <div key={entry.id} ref={drag.rowRef(index)} className={drag.rowClass(index)}>
            <ListCard className="fw-basket-entry-card">
            <ItemRow
              row={row}
              unit={unit}
              onClick={() => onEdit(entry)}
              leading={entries.length > 1 ? <DragHandle label={`拖曳排序 ${row.item.name}`} {...drag.handleProps(index)} /> : undefined}
              // 菜籃裡的說明文字講的是「我常買多少、大概多少錢」，不是划算度——划算度
              // 在價格旁邊的徽章已經有了，這裡重複講一次只是佔掉唯一能放份量的位置。
              meta={
                costOfEntry === null
                  ? "還沒填常買份量"
                  : `常買 ${entry.qtyCatty} ${unitShort("catty")}・約 ${formatMoney(costOfEntry)} 元`
              }
            />
            </ListCard>
          </div>
        );
      })}
      </CollapsibleList>
      <AddButton onClick={onAdd}>{`新增${copy.entry}`}</AddButton>
    </>
  );
}
