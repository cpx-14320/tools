"use client";
import {useMemo,useState} from "react";
import {Callout,EmptyState,FilterPill,GhostButton,Hint,PageTitle,Paper,SearchInput,SegmentedTabs} from "@/components/freshwise/ui";
import {ItemRow} from "@/components/freshwise/item-row";
import {GameIcon} from "@/components/freshwise/game-art";
import {MarketContext} from "@/components/freshwise/market-context";
import {GoTopButton} from "@/components/freshwise/go-top-button";
import {useFreshwise} from "@/components/freshwise/store";
import {copy,text} from "@/components/freshwise/theme";
import {isInBasket} from "@/lib/freshwise/basket";
import {CATEGORIES} from "@/lib/freshwise/catalog";
import {filterRows,rowsFromBook,sortRows,SORT_OPTIONS,type SortKey} from "@/lib/freshwise/search";
import {unitLabel} from "@/lib/freshwise/price";
import type {CategoryKey,PriceBook} from "@/lib/freshwise/types";
export function BrowseView({today,book,initialKeyword,initialCategory}:{today:string;book:PriceBook;initialKeyword:string;initialCategory:CategoryKey|""}){
 const {prefs,basket,toggleBasket}=useFreshwise();
 const [keyword,setKeyword]=useState(initialKeyword),[category,setCategory]=useState<CategoryKey|"">(initialCategory),[sort,setSort]=useState<SortKey>("recommended");
 const [inSeasonOnly,setInSeasonOnly]=useState(false),[cheapOnly,setCheapOnly]=useState(false),[measuredOnly,setMeasuredOnly]=useState(false),[filtersOpen,setFiltersOpen]=useState(false),[sortOpen,setSortOpen]=useState(false);
 const allRows=useMemo(()=>rowsFromBook(book.quotes,today),[book.quotes,today]);
 const rows=useMemo(()=>sortRows(filterRows(allRows,{category,keyword,inSeasonOnly,cheapOnly,measuredOnly}),sort),[allRows,category,keyword,inSeasonOnly,cheapOnly,measuredOnly,sort]);
 const activeFilters=Number(inSeasonOnly)+Number(cheapOnly)+Number(measuredOnly);
 const filtering=!!activeFilters||!!keyword.trim()||!!category;
 const estimatedCount=allRows.filter(row=>row.quote.estimated).length;
 function clear(){setKeyword("");setCategory("");setInSeasonOnly(false);setCheapOnly(false);setMeasuredOnly(false)}
 return <div className="fw-page fw-browse-page">
 <PageTitle>逛逛行情</PageTitle><p className="fw-helper-note">先看看，再決定今天買什麼。</p>
 <SearchInput value={keyword} onChange={setKeyword} placeholder="搜尋食材或常用名稱"/>
 <MarketContext book={book} today={today}/>
 <div className="fw-category-shelf" role="group" aria-label="食材分類"><button type="button" aria-pressed={!category} onClick={()=>setCategory("")}><GameIcon name="book" size={48}/><span>全部</span></button>{CATEGORIES.map(c=><button key={c.key} type="button" aria-pressed={category===c.key} onClick={()=>setCategory(c.key)}><GameIcon name={c.key} size={48}/><span>{c.name}</span></button>)}</div>
 <div className="fw-list-toolbar"><button type="button" className="fw-filter-toggle" aria-expanded={sortOpen} onClick={()=>setSortOpen(!sortOpen)}><GameIcon name="pencil" size={28}/>{SORT_OPTIONS.find(s=>s.key===sort)?.label}<span className="fw-dropdown-arrow" aria-hidden="true">▼</span></button><button type="button" className="fw-filter-toggle" aria-expanded={filtersOpen} onClick={()=>setFiltersOpen(!filtersOpen)}><GameIcon name="filter" size={32}/>篩選{activeFilters? ` ${activeFilters}`:""}</button></div>
 {sortOpen&&<SegmentedTabs items={SORT_OPTIONS} value={sort} onChange={value=>{setSort(value);setSortOpen(false)}} scroll/>}
 {filtersOpen&&<div className="fw-filter-panel"><div className="fw-filter-pills"><FilterPill label="只看當季" active={inSeasonOnly} onClick={()=>setInSeasonOnly(!inSeasonOnly)}/><FilterPill label="只看划算" active={cheapOnly} onClick={()=>setCheapOnly(!cheapOnly)}/><FilterPill label="只看實際訪價" active={measuredOnly} onClick={()=>setMeasuredOnly(!measuredOnly)}/></div>{filtering&&<GhostButton onClick={clear}>清除條件</GhostButton>}</div>}
 {prefs.venue==="super"&&<Callout>{copy.estimatedNote}</Callout>}
 {prefs.venue==="market"&&estimatedCount>0&&<Callout>{copy.retailCoverageNote}</Callout>}
 <div className="flex items-center justify-between gap-2"><h2 className={text.sectionTitle}>{category?CATEGORIES.find(c=>c.key===category)?.name:"食材"}行情</h2><Hint>共 {rows.length} 項 · {unitLabel(prefs.unit)}</Hint></div>
 <p className="fw-helper-note flex items-center gap-2"><GameIcon name="seed" size={30}/>點種子袋，加入我的菜籃。</p>
 {filtering&&<div className="flex items-center justify-between"><Hint>正在套用查詢條件</Hint><GhostButton onClick={clear}>清除條件</GhostButton></div>}
 <Paper variant="list">{rows.length?rows.map(row=><ItemRow key={row.item.code} row={row} unit={prefs.unit} href={`/tools/freshwise/browse/${row.item.code}`} starred={isInBasket(basket,row.item.code)} onToggleStar={()=>toggleBasket(row.item.code,row.item.name)}/>):<EmptyState icon="magnifying-glass" title={allRows.length?"沒有符合條件的食材":"這個場所目前還沒有行情"} description={allRows.length?"試試其他名稱，或放寬分類和篩選條件。":"資料來源可能尚未更新，換個場所或市場看看。"}/>}</Paper>
 <Callout icon="database">{copy.sourceNote}</Callout>
 <GoTopButton visible={rows.length>=8}/>
 </div>
}
