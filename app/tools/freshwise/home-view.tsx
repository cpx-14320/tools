"use client";
import {useMemo,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {Callout,CollapsibleList,EmptyState,Hint,Paper,SearchInput,SectionTitle} from "@/components/freshwise/ui";
import {ItemIcon} from "@/components/freshwise/item-icon";
import {ItemRow} from "@/components/freshwise/item-row";
import {PriceText} from "@/components/freshwise/price-text";
import {TrendBadge} from "@/components/freshwise/badges";
import {MarketContext} from "@/components/freshwise/market-context";
import {useFreshwise} from "@/components/freshwise/store";
import {useCompanion} from "@/components/freshwise/companion-store";
import {DewBalance,QuestSlip} from "@/components/freshwise/companion-widgets";
import {GameIcon,PetArtwork} from "@/components/freshwise/game-art";
import {copy} from "@/components/freshwise/theme";
import {allCodes} from "@/lib/freshwise/basket";
import {categoryImage,itemImage,CATEGORIES} from "@/lib/freshwise/catalog";
import {buildBrief,briefReason} from "@/lib/freshwise/advice";
import {rowsFromBook} from "@/lib/freshwise/search";
import {companionLevel} from "@/lib/freshwise/companions";
import type {PriceBook} from "@/lib/freshwise/types";

export function HomeView({today,book}:{today:string;book:PriceBook}){
 const router=useRouter();
 const {prefs,basket,basketReady,toggleBasket}=useFreshwise();
 const {state,ready}=useCompanion();
 const [keyword,setKeyword]=useState("");
 const rows=useMemo(()=>rowsFromBook(book.quotes,today),[book.quotes,today]);
 const brief=useMemo(()=>buildBrief(rows,today,book.dataDate),[rows,today,book.dataDate]);
 const headline=[...brief.cheapest,...brief.risers,...brief.seasonal].find(row=>brief.advice.includes(row.item.name))??brief.cheapest[0]??brief.seasonal[0]??rows.find(r=>!r.quote.estimated)??rows[0];
 const basketCodes=allCodes(basket);
 // 菜籃裡所有「今天這個場所有行情」的項目都帶進來，顯示幾筆交給 CollapsibleList。
 const basketRows=rows.filter(row=>basketCodes.includes(row.item.code));
 // 等級、進度、稱呼跟夥伴頁共用同一份計算，兩頁不會長不一樣。
 const {pet,progress:growthInLevel,max:growthMax,label:levelLabel}=companionLevel(state);
 function search(){router.push(keyword.trim()?`/tools/freshwise/browse?q=${encodeURIComponent(keyword.trim())}`:"/tools/freshwise/browse")}
 return <div className="fw-page fw-home">
 <div className="fw-home-garden">
 <header className="fw-home-brand"><div><small>FreshWise · 蔬果夥伴</small><h1>{copy.appName}</h1></div><DewBalance/></header>
 <MarketContext book={book} today={today} showDate={false}/>
 <section className="fw-home-hero" aria-label="今天的買菜建議">
 <h2 className="fw-home-speech">{prefs.showAdvice?brief.advice:"今天也和夥伴一起，慢慢看懂買菜行情。"}{headline?.quote.estimated&&!brief.advice.includes("推估")&&<small>（推估參考）</small>}</h2>
 <div className="fw-hero-stage">
 <div className="fw-hero-companion">
   <PetArtwork id={state.active} size={200} priority className="fw-breathe"/>
   <span className="fw-hero-level">{ready?levelLabel:"夥伴準備中…"}</span>
   {ready&&<div className="fw-hero-growth">
     <span>成長 <strong>{growthInLevel}／{growthMax}</strong></span>
     <progress value={growthInLevel} max={growthMax} aria-label={`${pet.nickname}的成長 ${growthInLevel}／${growthMax}`}/>
   </div>}
 </div>
 <div className="fw-hero-price-column">
 {headline?<Link className="fw-price-tag" href={`/tools/freshwise/browse/${headline.item.code}`}>
   <h2>{headline.item.name}</h2>
   <span className="fw-tag-price-line">
     <PriceText priceKg={headline.quote.avgKg} rangeLowKg={headline.quote.rangeLowKg} rangeHighKg={headline.quote.rangeHighKg} unit={prefs.unit} size="tag" showUnit={false}/>
     <span className="fw-tag-unit">元／{prefs.unit==="catty"?"台斤":"公斤"}</span>
   </span>
   {!headline.quote.estimated&&<TrendBadge trend={headline.trend}/>}
   <span className="fw-tag-unit">看價格詳情 →</span>
 </Link>:<div className="fw-price-tag"><GameIcon name="calendar" size={40}/><p>行情準備中</p></div>}
 <Link href="/tools/freshwise/companions" className="fw-game-button fw-hero-link">陪夥伴玩 →</Link>
 </div>
 </div>
 </section>
 <QuestSlip/>
 </div>
 <SearchInput value={keyword} onChange={setKeyword} onSubmit={search} placeholder="搜尋食材或常用名稱"/>
 <nav className="fw-category-shelf" aria-label="食材分類">{CATEGORIES.map(category=><Link key={category.key} href={`/tools/freshwise/browse?category=${category.key}`}><ItemIcon src={categoryImage(category.key)} fallbackIcon={category.icon} alt={category.name} size={48}/><span>{category.name}</span></Link>)}</nav>
 {brief.estimatedCount>0&&<Callout>{prefs.venue==="super"?copy.estimatedNote:`這個場所有 ${brief.estimatedCount} 項是估算範圍，並非實際訪價。`}</Callout>}
 {brief.delayed&&<Callout icon="calendar-xmark">目前顯示的是 {book.dataDate} 的資料。{prefs.venue==="wholesale"?"休市或來源更新時間可能影響資料日期。":"資料來源尚未更新至今日。"}</Callout>}
 {brief.cheapest.length>0&&<section className="fw-feature-shelf"><SectionTitle leaf action={<Link href="/tools/freshwise/browse">看全部 →</Link>}>今天值得買</SectionTitle><div className="fw-market-display">{brief.cheapest.slice(0,2).map(row=><Link key={row.item.code} href={`/tools/freshwise/browse/${row.item.code}`} className="fw-market-product" aria-label={`${row.item.name}，${briefReason(row,"cheap")}，查看行情`}><span className="fw-market-food"><ItemIcon src={itemImage(row.item.code)} fallbackIcon={row.item.icon} alt={row.item.name} size={90}/></span><span className="fw-market-price"><h3>{row.item.name}</h3><PriceText priceKg={row.quote.avgKg} rangeLowKg={row.quote.rangeLowKg} rangeHighKg={row.quote.rangeHighKg} unit={prefs.unit} size="row" showUnit={false}/><span className="fw-market-unit">元／{prefs.unit==="catty"?"台斤":"公斤"}{row.quote.estimated?" · 估算":""}</span>{!row.quote.estimated&&<TrendBadge trend={row.trend} size="sm"/>}</span></Link>)}</div></section>}
 <section><SectionTitle leaf action={<Link href="/tools/freshwise/basket" className="fw-leaf-link">查看菜籃 →</Link>}>我的菜籃</SectionTitle>
 {!basketReady?<Hint center>{copy.loading}</Hint>:basketRows.length? <Paper variant="list"><CollapsibleList max={5}>{basketRows.map(row=><ItemRow key={row.item.code} row={row} unit={prefs.unit} href={`/tools/freshwise/browse/${row.item.code}`} starred onToggleStar={()=>toggleBasket(row.item.code,row.item.name)}/>)}</CollapsibleList></Paper>:<EmptyState icon="basket-shopping" title={basketCodes.length?"菜籃裡的食材目前沒有行情":"先挑幾樣你常買的菜"} description="把常買的食材加入菜籃，下次就能直接看價格。" action={<Link href="/tools/freshwise/browse" className="fw-game-button">去逛逛行情</Link>}/>}
 </section>
 {brief.seasonal.length>0&&<section><SectionTitle leaf>現在正當季</SectionTitle><Paper variant="list"><CollapsibleList max={5}>{brief.seasonal.map(row=><ItemRow key={row.item.code} row={row} unit={prefs.unit} href={`/tools/freshwise/browse/${row.item.code}`} meta={briefReason(row,"season")}/>)}</CollapsibleList></Paper></section>}
 {brief.risers.length>0&&<section><SectionTitle leaf>漲價了，慢慢挑</SectionTitle><Paper variant="list"><CollapsibleList max={5}>{brief.risers.map(row=><ItemRow key={row.item.code} row={row} unit={prefs.unit} href={`/tools/freshwise/browse/${row.item.code}`} meta={briefReason(row,"rise")}/>)}</CollapsibleList></Paper></section>}
 {brief.total===0&&<EmptyState icon="cloud-arrow-down" title="今天還沒有行情資料" description="資料來源可能尚未更新。可以先整理菜籃，再晚一點回來看看。"/>}
 <Callout icon="database">{copy.sourceNote}</Callout>
 </div>;
}
