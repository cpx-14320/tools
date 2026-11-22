"use client";
import {useMemo,useState} from "react";
import {Callout,EmptyState,FilterPill,Hint,PageTitle,Paper,SearchInput,SortBar} from "@/components/freshwise/ui";
import {ItemRow} from "@/components/freshwise/item-row";
import {GameIcon} from "@/components/freshwise/game-art";
import {StickyShelf} from "@/components/freshwise/sticky-shelf";
import {MarketContext} from "@/components/freshwise/market-context";
import {GoTopButton} from "@/components/freshwise/go-top-button";
import {useFreshwise} from "@/components/freshwise/store";
import {copy,text} from "@/components/freshwise/theme";
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
 const activeFilters=Number(inSeasonOnly)+Number(cheapOnly)+Number(measuredOnly);
 const estimatedCount=allRows.filter(row=>row.quote.estimated).length;
 return <div className="fw-page fw-browse-page">
 <PageTitle hanging>逛逛行情</PageTitle>
 <MarketContext book={book} today={today}/>
 <StickyShelf className="fw-category-shelf"><div role="group" aria-label="食材分類" className="contents"><button type="button" aria-pressed={!category} onClick={()=>setCategory("")}><GameIcon name="book" size={40}/><span>全部</span></button>{CATEGORIES.map(c=><button key={c.key} type="button" aria-pressed={category===c.key} onClick={()=>setCategory(c.key)}><GameIcon name={c.key} size={40}/><span>{c.name}</span></button>)}</div></StickyShelf>
 <SearchInput value={keyword} onChange={setKeyword} placeholder="搜尋食材或常用名稱"/>
 {/* 排序與篩選一開始就看得到、直接能點。以前要先點「推薦 ▼」才展開分頁，等於把一個
     單純的切換做成兩段操作——使用者還沒看到有哪些選項，就得先按一下。 */}
 <div className="fw-list-toolbar"><button type="button" className="fw-filter-toggle" aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(!filtersOpen)}><GameIcon name="filter" size={32}/>篩選{activeFilters? ` ${activeFilters}`:""}</button></div>
 <SortBar options={SORT_COLUMNS} value={sort} onChange={setSort}/>
 {filtersOpen&&<div className="fw-filter-panel"><div className="fw-filter-pills"><FilterPill label="只看當季" active={inSeasonOnly} onClick={()=>setInSeasonOnly(!inSeasonOnly)}/><FilterPill label="只看划算" active={cheapOnly} onClick={()=>setCheapOnly(!cheapOnly)}/><FilterPill label="只看實際訪價" active={measuredOnly} onClick={()=>setMeasuredOnly(!measuredOnly)}/></div></div>}
 {/* 這兩張本來在首頁。首頁的主視覺是「今天買什麼」，資料品質的但書放在那裡會先擋住
     重點；真正會在意「這個數字準不準」的人是在行情頁逐項比較的時候。 */}
 {estimatedCount>0&&<Callout>{`其中 ${estimatedCount} 項臺中沒有訪到價，是用批發價推估的區間（那幾列會標「估算」）。`}</Callout>}
 {book.dataDate!==today&&<Callout icon="calendar-xmark">目前顯示的是 {book.dataDate} 的資料，來源尚未更新至今日。</Callout>}
 <div className="flex items-center justify-between gap-2"><h2 className={text.sectionTitle}>{category?CATEGORIES.find(c=>c.key===category)?.name:"食材"}行情</h2><Hint>共 {rows.length} 項 · {unitLabel(prefs.unit)}</Hint></div>
 <p className="fw-helper-note flex items-center gap-2"><GameIcon name="seed" size={30}/>點種子袋，加入我的菜籃。</p>
 <Paper variant="list">{rows.length?rows.map(row=><ItemRow key={row.item.code} row={row} unit={prefs.unit} href={`/tools/freshwise/browse/${row.item.code}`} starred={isInBasket(basket,row.item.code)} onToggleStar={()=>toggleBasket(row.item.code,row.item.name)}/>):<EmptyState icon="magnifying-glass" title={allRows.length?"沒有符合條件的食材":"這個場所目前還沒有行情"} description={allRows.length?"試試其他名稱，或放寬分類和篩選條件。":"資料來源可能尚未更新，換個場所或市場看看。"}/>}</Paper>
 <Callout icon="database">{copy.sourceNote}</Callout>
 <GoTopButton visible={rows.length>=8}/>
 </div>
}
