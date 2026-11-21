"use client";
import {useMemo,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {Callout,EmptyState,Hint,SearchInput,SectionTitle} from "@/components/freshwise/ui";
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
import {categoryImage,CATEGORIES} from "@/lib/freshwise/catalog";
import {buildBrief,briefReason} from "@/lib/freshwise/advice";
import {rowsFromBook} from "@/lib/freshwise/search";
import {COMPANIONS} from "@/lib/freshwise/companions";
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
 const basketRows=rows.filter(row=>basketCodes.includes(row.item.code)).slice(0,4);
 const pet=COMPANIONS.find(p=>p.id===state.active)??COMPANIONS[0];
 const growthInLevel=state.xp%40;
 function search(){router.push(keyword.trim()?`/tools/freshwise/browse?q=${encodeURIComponent(keyword.trim())}`:"/tools/freshwise/browse")}
 return <div className="fw-page fw-home">
 <div className="fw-home-garden">
 <header className="fw-home-brand"><div><small>FreshWise · 蔬果夥伴</small><h1>{copy.appName}</h1></div><DewBalance/></header>
 <MarketContext book={book} today={today}/>
 <section className="fw-home-hero" aria-label="今天的買菜建議">
 <h2 className="fw-home-speech">{prefs.showAdvice?brief.advice:"今天也和夥伴一起，慢慢看懂買菜行情。"}{headline?.quote.estimated&&!brief.advice.includes("推估")&&<small>（推估參考）</small>}</h2>
 <div className="fw-hero-stage">
 <div className="fw-hero-companion">
   {state.enabled?<PetArtwork id={state.active} size={200} priority className="fw-breathe"/>:<GameIcon name="market" size={40}/>}
   <span className="fw-hero-level">{ready?`Lv.${1+Math.floor(state.xp/40)} ${pet.nickname}`:"夥伴準備中…"}</span>
   {ready&&state.enabled&&<div className="fw-hero-growth">
     <span>成長 <strong>{growthInLevel}／40</strong></span>
     <progress value={growthInLevel} max={40} aria-label={`${pet.nickname}的成長 ${growthInLevel}／40`}/>
   </div>}
 </div>
 <div className="fw-hero-price-column">
 {headline?<Link className="fw-price-tag" href={`/tools/freshwise/browse/${headline.item.code}`}>
   <h2>{headline.item.name}</h2>
   <span className="fw-tag-price-line">
     <PriceText priceKg={headline.quote.avgKg} rangeLowKg={headline.quote.rangeLowKg} rangeHighKg={headline.quote.rangeHighKg} unit={prefs.unit} size="big" showUnit={false}/>
     <span className="fw-tag-unit">元／{prefs.unit==="catty"?"台斤":"公斤"}</span>
   </span>
   {!headline.quote.estimated&&<TrendBadge trend={headline.trend}/>}
   <span className="fw-tag-unit">看價格詳情 →</span>
 </Link>:<div className="fw-price-tag"><GameIcon name="calendar" size={40}/><p>行情準備中</p></div>}
 {state.enabled&&<Link href="/tools/freshwise/companions" className="fw-game-button fw-hero-link">陪夥伴玩 →</Link>}
 </div>
 </div>
 </section>
 <QuestSlip/>
 </div>
 <SearchInput value={keyword} onChange={setKeyword} onSubmit={search} placeholder="搜尋食材或常用名稱"/>
 <nav className="fw-category-shelf" aria-label="食材分類">{CATEGORIES.map(category=><Link key={category.key} href={`/tools/freshwise/browse?category=${category.key}`}><ItemIcon src={categoryImage(category.key)} fallbackIcon={category.icon} alt={category.name} size={40}/><span>{category.name}</span></Link>)}</nav>
 {brief.estimatedCount>0&&<Callout>{prefs.venue==="super"?copy.estimatedNote:`這個場所有 ${brief.estimatedCount} 項是估算範圍，並非實際訪價。`}</Callout>}
 {brief.delayed&&<Callout icon="calendar-xmark">目前顯示的是 {book.dataDate} 的資料。{prefs.venue==="wholesale"?"休市或來源更新時間可能影響資料日期。":"資料來源尚未更新至今日。"}</Callout>}
 {brief.cheapest.length>0&&<section className="fw-feature-shelf"><SectionTitle leaf action={<Link href="/tools/freshwise/browse">看全部 →</Link>}>今天值得買</SectionTitle><div>{brief.cheapest.map(row=><ItemRow key={row.item.code} row={row} unit={prefs.unit} href={`/tools/freshwise/browse/${row.item.code}`} meta={briefReason(row,"cheap")}/>)}</div></section>}
 <section><SectionTitle leaf action={<Link href="/tools/freshwise/basket" className="fw-leaf-link">查看菜籃 →</Link>}>我的菜籃</SectionTitle>
 {!basketReady?<Hint center>{copy.loading}</Hint>:basketRows.length? <div className="fw-price-list">{basketRows.map(row=><ItemRow key={row.item.code} row={row} unit={prefs.unit} href={`/tools/freshwise/browse/${row.item.code}`} starred onToggleStar={()=>toggleBasket(row.item.code,row.item.name)}/>)}</div>:<EmptyState icon="basket-shopping" title={basketCodes.length?"菜籃裡的食材目前沒有行情":"先挑幾樣你常買的菜"} description="把常買的食材加入菜籃，下次就能直接看價格。" action={<Link href="/tools/freshwise/browse" className="fw-game-button">去逛逛行情</Link>}/>}
 </section>
 {brief.seasonal.length>0&&<section><SectionTitle leaf>現在正當季</SectionTitle><div className="fw-price-list">{brief.seasonal.map(row=><ItemRow key={row.item.code} row={row} unit={prefs.unit} href={`/tools/freshwise/browse/${row.item.code}`} meta={briefReason(row,"season")}/>)}</div></section>}
 {brief.risers.length>0&&<section><SectionTitle leaf>漲價了，慢慢挑</SectionTitle><div className="fw-price-list">{brief.risers.map(row=><ItemRow key={row.item.code} row={row} unit={prefs.unit} href={`/tools/freshwise/browse/${row.item.code}`} meta={briefReason(row,"rise")}/>)}</div></section>}
 {brief.total===0&&<EmptyState icon="cloud-arrow-down" title="今天還沒有行情資料" description="資料來源可能尚未更新。可以先整理菜籃，再晚一點回來看看。"/>}
 <Callout icon="database" tone="neutral">{copy.sourceNote}</Callout>
 </div>;
}
