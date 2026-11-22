"use client";
import {useState} from "react";import {useFreshwise} from "./store";import {GameIcon} from "./game-art";import {Hint,SegmentedTabs} from "./ui";import {MarketPickerModal} from "./market-picker-modal";import {VENUES,venueMeta} from "@/lib/freshwise/catalog";import {formatShortDate} from "@/lib/freshwise/dates";import type {PriceBook,VenueKey} from "@/lib/freshwise/types";
/** `showDate`：首頁不畫資料日期那一行——那裡已經有「目前顯示的是 X 的資料」的提示條，
 *  同一件事在主視覺上講兩次。行情頁沒有那張提示條，所以仍然要畫。 */
/* 場所分頁一開始就展開——「現在在哪個場所」跟「要換到哪個場所」是同一件事，
   藏在一次點擊後面只是多一步，而且使用者看不到有哪些選項可以換。 */
export function MarketContext({book,today,showDate=true,showNote=true}:{book:PriceBook;today:string;showDate?:boolean;showNote?:boolean}){const {prefs,setVenue,setMarket,setPrefs}=useFreshwise();const [marketsOpen,setMarketsOpen]=useState(false);const venue=venueMeta(prefs.venue),market=book.markets.find(m=>m.code===prefs.marketCode);return <section className="fw-market-context" aria-label="目前查詢的場所、市場和單位">
<div className="fw-context-strip"><span className="fw-venue-label"><GameIcon name="market" size={36}/><strong>{venue.name}</strong></span><button type="button" onClick={()=>setMarketsOpen(true)} aria-label="選擇市場">{market?.name??"全部市場"}<span className="fw-dropdown-arrow" aria-hidden="true">▼</span></button><button className="fw-unit-leaf" type="button" onClick={()=>setPrefs({unit:prefs.unit==="catty"?"kg":"catty"})} aria-label={`切換價格單位，目前${prefs.unit==="catty"?"台斤":"公斤"}`}>{prefs.unit==="catty"?"台斤":"公斤"}</button></div>
<div className="fw-place-options"><SegmentedTabs items={VENUES.map(v=>({key:v.key,label:v.name}))} value={prefs.venue} onChange={(key:VenueKey)=>setVenue(key)} scroll/>{showNote&&<Hint>{venue.description}</Hint>}</div>
{showDate&&<p className="fw-data-date"><GameIcon name="calendar" size={24}/>資料日期 {formatShortDate(book.dataDate)}{book.dataDate!==today&&" · 尚未更新至今日"}</p>}
<MarketPickerModal open={marketsOpen} venue={prefs.venue} value={prefs.marketCode} markets={book.markets} onClose={()=>setMarketsOpen(false)} onConfirm={code=>{setMarket(code);setMarketsOpen(false)}}/></section>}
