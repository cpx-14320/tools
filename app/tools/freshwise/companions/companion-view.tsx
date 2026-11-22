"use client";
import { useState } from "react";
import Link from "next/link";
import { COMPANIONS } from "@/lib/freshwise/companions";
import { useCompanion } from "@/components/freshwise/companion-store";
import { CollectionArtwork, GameIcon, PetArtwork } from "@/components/freshwise/game-art";
import { DewBalance, QuestSlip } from "@/components/freshwise/companion-widgets";
import { PageTitle } from "@/components/freshwise/ui";

export function CompanionView() {
  const { state, ready, care, select, storageAvailable } = useCompanion();
  const [tab, setTab] = useState<"care" | "collection">("care");
  const pet = COMPANIONS.find((p) => p.id === state.active) ?? COMPANIONS[0];
  const owned = COMPANIONS.filter((p) => p.threshold <= state.stamps);
  const level = 1 + Math.floor(state.xp / 40);
  return <div className="fw-page fw-companions-page">
    <div className="fw-companions-hero">
    <PageTitle actions={<DewBalance />}>我的蔬果夥伴</PageTitle>
    <div className="fw-book-tabs" role="group" aria-label="夥伴頁面"><button type="button" aria-pressed={tab === "care"} onClick={() => setTab("care")}><GameIcon name="companions" />陪伴夥伴</button><button type="button" aria-pressed={tab === "collection"} onClick={() => setTab("collection")}><GameIcon name="book" />蔬果圖鑑</button></div>
    {ready && tab === "care" && <section className="fw-companion-garden"><h2>{pet.name}</h2><span className="fw-level-ribbon">Lv.{level} · {level < 3 ? "萌芽" : level < 8 ? "幼苗" : "葉葉"}夥伴</span><p className="fw-pet-speech">一起看看今天的菜價吧！</p><PetArtwork id={pet.id} size={200} priority className="fw-breathe" /></section>}
    {ready && tab === "care" && <>
      <section className="fw-growth"><div className="fw-growth-vine"><GameIcon name="leaf" /><progress value={state.xp % 40} max={40} aria-label={`成長 ${state.xp % 40}／40`} /><GameIcon name="leaf" /></div><strong>成長 {state.xp % 40}／40</strong><p>再陪伴一點，就能升級囉。</p></section>
      <div className="fw-care-actions"><button type="button" className="fw-game-button" disabled={state.dew < 3} onClick={() => care("water")}><GameIcon name="water" size={40} />澆水 · 3 露珠</button><button type="button" className="fw-game-button fw-peach-button" disabled={state.played} onClick={() => care("play")}><GameIcon name="play" size={40} />{state.played ? "今天玩過囉" : "陪玩"}</button></div>
    </>}
    </div>
    {!ready ? <p className="fw-loading" role="status">夥伴正在準備小花園…</p> : tab === "care" ? <>
      <section className="fw-diary"><h2><GameIcon name="leaf" size={30} />{pet.nickname}的小日記</h2><p>{pet.story}</p>{pet.code && <Link className="fw-leaf-link" href={`/tools/freshwise/browse/${pet.code}`}>一起去看看行情 →</Link>}</section>
      {state.dew < 3 && <p className="fw-helper-note">完成下面的探索任務，就有露珠可以澆水。每天第一次陪玩也能增加成長。</p>}
    </> : <section className="fw-collection-book"><h2>蔬果圖鑑 <small>已結識 {owned.length}／{COMPANIONS.length} 位</small></h2><p>每一次探索，都多認識一位朋友。</p><div className="fw-collection-grid">{COMPANIONS.map((p) => { const unlocked = p.threshold <= state.stamps; return <button type="button" key={p.id} className={`fw-collection-pet ${unlocked ? "" : "fw-pet-locked"}`} disabled={!unlocked} aria-pressed={state.active === p.id} onClick={() => { select(p.id); setTab("care"); }}><CollectionArtwork id={p.id} /><strong>{p.name}</strong><span>{state.active === p.id ? "陪伴中" : unlocked ? "一起陪伴 →" : `印章 ${Math.min(state.stamps, p.threshold)}／${p.threshold}`}</span></button>; })}</div><p className="fw-helper-note">完成探索就能結識，不需要購買食材。南瓜慢慢是花園夥伴，目前沒有對應的查價品項。</p></section>}
    <QuestSlip all />
    <p className="fw-helper-note">{storageAvailable ? "夥伴與任務進度跟著你的帳號，換手機、換瀏覽器都會在。" : "目前連不上伺服器，這次的進度可能沒辦法保存。"}</p>
  </div>;
}
