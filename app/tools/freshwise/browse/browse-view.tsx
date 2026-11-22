"use client";
import {useMemo,useState} from "react";
import {Callout,EmptyState,FilterPill,Hint,PageTitle,Paper,SearchInput,SortBar} from "@/components/freshwise/ui";
import {ItemRow} from "@/components/freshwise/item-row";
import {GameIcon} from "@/components/freshwise/game-art";
import {StickyShelf} from "@/components/freshwise/sticky-shelf";
import {GroupPickerModal} from "@/components/freshwise/group-picker-modal";
import {MarketContext} from "@/components/freshwise/market-context";
import {GoTopButton} from "@/components/freshwise/go-top-button";
import {useFreshwise} from "@/components/freshwise/store";
import {text} from "@/components/freshwise/theme";
import {isInBasket} from "@/lib/freshwise/basket";
import {CATEGORIES} from "@/lib/freshwise/catalog";
import {filterRows,rowsFromBook,sortRows,type SortKey} from "@/lib/freshwise/search";
import {unitLabel} from "@/lib/freshwise/price";
import type {CategoryKey,PriceBook} from "@/lib/freshwise/types";
/** 排序列的三個欄位。推薦沒有方向；價格與漲跌重複點就換方向。 */
const SORT_COLUMNS = [
  {key:"recommended" as const,label:"推薦"},
  {key:"priceAsc" as const,label:"價格",asc:"priceAsc" as const,desc:"priceDesc" as const},
  {key:"drop" as const,label:"漲跌",asc:"drop" as const,desc:"rise" as const},
];

export function BrowseView({today,book,initialKeyword,initialCategory}:{today:string;book:PriceBook;initialKeyword:string;initialCategory:CategoryKey|""}){
 const {prefs,basket,toggleBasket}=useFreshwise();
 const [keyword,setKeyword]=useState(initialKeyword),[category,setCategory]=useState<CategoryKey|"">(initialCategory),[sort,setSort]=useState<SortKey>("recommended");
 const [inSeasonOnly,setInSeasonOnly]=useState(false),[cheapOnly,setCheapOnly]=useState(false),[measuredOnly,setMeasuredOnly]=useState(false),[filtersOpen,setFiltersOpen]=useState(false);
 const allRows=useMemo(()=>rowsFromBook(book.quotes,today),[book.quotes,today]);
 const rows=useMemo(()=>sortRows(filterRows(allRows,{category,keyword,inSeasonOnly,cheapOnly,measuredOnly}),sort),[allRows,category,keyword,inSeasonOnly,cheapOnly,measuredOnly,sort]);
 // 分類超過一個時，加入菜籃要先問「加到哪一籃」——不然分了類也沒用，全部掉進第一個。
 const [adding,setAdding]=useState<{code:string;name:string}|null>(null);
 const activeFilters=Number(inSeasonOnly)+Number(cheapOnly)+Number(measuredOnly);
 return <div className="fw-page fw-browse-page">
 <PageTitle hanging>逛逛行情</PageTitle>
 {/* 資料日期放在最上面：使用者看價格之前要先知道這是哪一天的數字。 */}
 {book.dataDate!==today&&<Callout icon="calendar-xmark">目前顯示的是 {book.dataDate} 的資料。</Callout>}
 <MarketContext book={book}/>
 <StickyShelf className="fw-category-shelf" role="group" label="食材分類"><button type="button" aria-pressed={!category} onClick={()=>setCategory("")}><GameIcon name="book" size={40}/><span className="sr-only">全部</span></button>{CATEGORIES.map(c=><button key={c.key} type="button" aria-pressed={category===c.key} onClick={()=>setCategory(c.key)}><GameIcon name={c.key} size={40}/><span className="sr-only">{c.name}</span></button>)}</StickyShelf>
 <SearchInput value={keyword} onChange={setKeyword} placeholder="搜尋食材或常用名稱"/>
 <div className="flex items-center justify-between gap-2"><h2 className={text.sectionTitle}>{category?CATEGORIES.find(c=>c.key===category)?.name:"食材"}行情</h2><Hint>共 {rows.length} 項 · {unitLabel(prefs.unit)}</Hint></div>
 <SortBar options={SORT_COLUMNS} value={sort} onChange={setSort} filterCount={activeFilters} onFilter={()=>setFiltersOpen(!filtersOpen)} filterOpen={filtersOpen}/>
 {filtersOpen&&<div className="fw-filter-panel"><div className="fw-filter-pills"><FilterPill label="只看當季" active={inSeasonOnly} onClick={()=>setInSeasonOnly(!inSeasonOnly)}/><FilterPill label="只看划算" active={cheapOnly} onClick={()=>setCheapOnly(!cheapOnly)}/><FilterPill label="只看實際訪價" active={measuredOnly} onClick={()=>setMeasuredOnly(!measuredOnly)}/></div></div>}
 <Paper variant="list">{rows.length?rows.map(row=><ItemRow key={row.item.code} row={row} unit={prefs.unit} href={`/tools/freshwise/browse/${row.item.code}`} starred={isInBasket(basket,row.item.code)} onToggleStar={()=>{const inBasket=isInBasket(basket,row.item.code);if(!inBasket&&basket.groups.length>1){setAdding({code:row.item.code,name:row.item.name});return}toggleBasket(row.item.code,row.item.name)}}/>):<EmptyState icon="magnifying-glass" title={allRows.length?"沒有符合條件的食材":"這個場所目前還沒有行情"} description={allRows.length?"試試其他名稱，或放寬分類和篩選條件。":"資料來源可能尚未更新，換個場所或市場看看。"}/>}</Paper>
 <GroupPickerModal open={adding!==null} basket={basket} itemName={adding?.name??""} onClose={()=>setAdding(null)} onPick={id=>{if(adding)toggleBasket(adding.code,adding.name,id);setAdding(null)}}/>
 <GoTopButton visible={rows.length>=8}/>
 </div>
}
