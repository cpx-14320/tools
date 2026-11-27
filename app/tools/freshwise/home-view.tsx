"use client";
import {useMemo,useState} from "react";
import Link from "next/link";
import {CollapsibleList,EmptyState,Hint,Paper,SectionTitle} from "@/components/freshwise/ui";
import {BottomSheetModal} from "@/components/freshwise/bottom-sheet-modal";
import {GoTopButton} from "@/components/freshwise/go-top-button";
import {ItemIcon} from "@/components/freshwise/item-icon";
import {ItemRow} from "@/components/freshwise/item-row";
import {PriceText} from "@/components/freshwise/price-text";
import {MarketContext} from "@/components/freshwise/market-context";
import {useFreshwise} from "@/components/freshwise/store";
import {useCompanion} from "@/components/freshwise/companion-store";
import {DewBalance,QuestSlip} from "@/components/freshwise/companion-widgets";
import {GameIcon,PetArtwork,SlicedArtwork} from "@/components/freshwise/game-art";
import {petLookStage} from "@/lib/freshwise/pet-expressions";
import {copy} from "@/components/freshwise/theme";
import {unitShort} from "@/lib/freshwise/price";
import {allCodes} from "@/lib/freshwise/basket";
import {itemImage} from "@/lib/freshwise/catalog";
import {buildBrief,briefReason} from "@/lib/freshwise/advice";
import {rowsFromBook} from "@/lib/freshwise/search";
import {companionLevel} from "@/lib/freshwise/companions";
import type {PriceBook} from "@/lib/freshwise/types";

/** 首頁三個區塊的口語說明，依實際挑選與排序規則呈現。 */
const SECTION_HELP = {
  seasonal: {
    title: "現在當季，怎麼挑？",
    lines: [
      "這裡挑的是這個月正當季的食材，今天煮什麼，可以從它們找靈感。",
      "有足夠紀錄、又比平常貴的食材會先略過，挑當季也順便顧荷包。",
      "有實際訪價的先放前面；「估算」是抓個大概，買之前可以再比一比。",
    ],
  },
  risers: {
    title: "漲價了，怎麼挑？",
    lines: [
      "這些食材的行情，比前一個有交易的日子漲了一些。",
      "有實際訪價的先放前面，估算價放後面；各自再把漲比較多的排前面。",
      "想買可以多比幾攤，或換道菜煮。「估算」的漲跌參考批發行情，攤位售價可能不同。",
    ],
  },
  fallers: {
    title: "跌價了，怎麼挑？",
    lines: [
      "這些食材的行情，比前一個有交易的日子降了一些。",
      "有實際訪價的先放前面，估算價放後面；各自再把跌比較多的排前面。",
      "剛好要用，可以挑幾樣帶回家。也能點進價格詳情，看看和平常差多少；「估算」的漲跌參考批發行情。",
    ],
  },
} as const;

export function HomeView({today,book}:{today:string;book:PriceBook}){
 const {prefs,basket,basketReady}=useFreshwise();
 const {state,ready}=useCompanion();
 const rows=useMemo(()=>rowsFromBook(book.quotes,today),[book.quotes,today]);
 const brief=useMemo(()=>buildBrief(rows,today,book.dataDate),[rows,today,book.dataDate]);
 const headline=[...brief.cheapest,...brief.risers,...brief.seasonal].find(row=>brief.advice.includes(row.item.name))??brief.cheapest[0]??brief.seasonal[0]??rows.find(r=>!r.quote.estimated)??rows[0];
 const [help,setHelp]=useState<keyof typeof SECTION_HELP|null>(null);
 const basketCodes=allCodes(basket);
 // 菜籃裡所有「今天這個場所有行情」的項目都帶進來，顯示幾筆交給 CollapsibleList。
 const basketRows=rows.filter(row=>basketCodes.includes(row.item.code));
 // 等級、進度、稱呼跟夥伴頁共用同一份計算，兩頁不會長不一樣。
 const {pet,progress:growthInLevel,max:growthMax,label:levelLabel}=companionLevel(state);
 return <div className="fw-page fw-home">
 <div className="fw-home-garden">
 <header className="fw-home-brand"><div><small>{copy.appNameEn} · 今天買菜看這裡</small><h1>{copy.appName}</h1></div><DewBalance/></header>
 <MarketContext book={book}/>
 <section className="fw-home-hero" aria-label="今天的買菜建議">
 <h2 className="fw-home-speech">{brief.advice}{headline?.quote.estimated&&!brief.advice.includes("推估")&&<small>（推估參考）</small>}</h2>
 <div className="fw-hero-stage">
 <div className="fw-hero-companion">
   <PetArtwork id={state.active} stage={petLookStage(state,state.active)} size={200} priority interactive className="fw-breathe" ready={ready}/>

 </div>
 <div className="fw-hero-price-column">
 {headline?<Link className="fw-price-tag" href={`/tools/freshwise/browse/${headline.item.code}`}>
   <h2>{headline.item.name}</h2>
   <span className="fw-tag-price-line">
     <PriceText priceKg={headline.quote.avgKg} rangeLowKg={headline.quote.rangeLowKg} rangeHighKg={headline.quote.rangeHighKg} unit={prefs.unit} size="tag" showUnit={false}/>
     <span className="fw-tag-unit">元／{unitShort(prefs.unit)}</span>
   </span>
   <span className="fw-tag-unit">看價格詳情 →</span>
 </Link>:<div className="fw-price-tag"><GameIcon name="calendar" size={40}/><p>行情準備中</p></div>}
 </div>
 <div className="fw-hero-pet-details">
   <span className="fw-hero-level"><SlicedArtwork name="companion-level-ribbon" className="fw-sliced-ribbon"/>{ready?levelLabel:"夥伴準備中…"}</span>
   {ready&&<div className="fw-hero-growth">
     <span>成長 <strong>{growthInLevel}／{growthMax}</strong></span>
     <progress value={growthInLevel} max={growthMax} aria-label={`${pet.nickname}的成長 ${growthInLevel}／${growthMax}`}/>
   </div>}
 </div>
 <Link href="/tools/freshwise/companions" className="fw-game-button fw-hero-link">陪夥伴玩 →</Link>
 </div>
 </section>
 <QuestSlip/>
 </div>
 {brief.cheapest.length>0&&<section className="fw-feature-shelf"><SectionTitle leaf action={<Link href="/tools/freshwise/browse">看全部 →</Link>}>今天值得買</SectionTitle><div className="fw-market-display">{brief.cheapest.slice(0,2).map(row=><Link key={row.item.code} href={`/tools/freshwise/browse/${row.item.code}`} className="fw-market-product" aria-label={`${row.item.name}，${briefReason(row,"cheap")}，查看行情`}><span className="fw-market-food"><ItemIcon src={itemImage(row.item.code)} fallbackIcon={row.item.icon} alt={row.item.name} size={90}/></span><span className="fw-market-price"><h3>{row.item.name}</h3><PriceText priceKg={row.quote.avgKg} rangeLowKg={row.quote.rangeLowKg} rangeHighKg={row.quote.rangeHighKg} unit={prefs.unit} size="row" showUnit={false}/><span className="fw-market-unit">元／{unitShort(prefs.unit)}{row.quote.estimated?" · 估算":""}</span></span></Link>)}</div></section>}
 <section><SectionTitle leaf action={<Link href="/tools/freshwise/basket" className="fw-leaf-link">查看菜籃 →</Link>}>我的菜籃</SectionTitle>
 {!basketReady?<Hint center>{copy.loading}</Hint>:basketRows.length? <Paper variant="list"><CollapsibleList>{basketRows.map(row=><ItemRow key={row.item.code} row={row} unit={prefs.unit} href={`/tools/freshwise/browse/${row.item.code}`}/>)}</CollapsibleList></Paper>:<EmptyState icon="basket-shopping" title={basketCodes.length?"菜籃裡的食材目前沒有行情":"先挑幾樣你常買的菜"} description="把常買的食材加入菜籃，下次就能直接看價格。" action={<Link href="/tools/freshwise/browse" className="fw-game-button">去逛逛行情</Link>}/>}
 </section>
 {brief.seasonal.length>0&&<section><SectionTitle leaf onHelp={()=>setHelp("seasonal")} helpLabel="了解現在正當季怎麼挑">現在正當季</SectionTitle><Paper variant="list"><CollapsibleList>{brief.seasonal.map(row=><ItemRow key={row.item.code} row={row} unit={prefs.unit} href={`/tools/freshwise/browse/${row.item.code}`} meta={briefReason(row,"season")}/>)}</CollapsibleList></Paper></section>}
 {brief.risers.length>0&&<section><SectionTitle leaf onHelp={()=>setHelp("risers")} helpLabel="了解漲價食材怎麼挑">漲價了，慢慢挑</SectionTitle><Paper variant="list"><CollapsibleList>{brief.risers.map(row=><ItemRow key={row.item.code} row={row} unit={prefs.unit} href={`/tools/freshwise/browse/${row.item.code}`}/>)}</CollapsibleList></Paper></section>}
 {brief.fallers.length>0&&<section><SectionTitle leaf onHelp={()=>setHelp("fallers")} helpLabel="了解跌價食材怎麼挑">跌價了，可以買</SectionTitle><Paper variant="list"><CollapsibleList>{brief.fallers.map(row=><ItemRow key={row.item.code} row={row} unit={prefs.unit} href={`/tools/freshwise/browse/${row.item.code}`}/>)}</CollapsibleList></Paper></section>}
 {brief.total===0&&<EmptyState icon="cloud-arrow-down" title="今天還沒有行情資料" description="資料來源可能尚未更新。可以先整理菜籃，再晚一點回來看看。"/>}
 <GoTopButton visible={brief.seasonal.length+brief.risers.length+brief.fallers.length>=8}/>
 <BottomSheetModal open={help!==null} title={help?SECTION_HELP[help].title:""} onClose={()=>setHelp(null)} bodyClassName="flex flex-col gap-3 px-5 py-5">
  {help&&SECTION_HELP[help].lines.map(line=><Hint key={line}>{line}</Hint>)}
 </BottomSheetModal>
 </div>;
}
