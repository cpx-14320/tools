"use client";
import Link from "next/link";
import { useCompanion } from "./companion-store";
import { GameIcon } from "./game-art";
import { questProgress, QUESTS } from "@/lib/freshwise/companions";
import { Switch, SectionTitle } from "./ui";

export function DewBalance() { const { state, ready } = useCompanion(); return <Link href="/tools/freshwise/companions" className="fw-dew-balance" aria-label={ready ? `我的夥伴，目前有 ${state.dew} 露珠` : "我的夥伴"}><GameIcon name="dew" size={30} /><span>{ready ? state.dew : "—"}</span></Link>; }
export function CompanionOptions() {
  const { state, ready, setOptions, storageAvailable } = useCompanion();
  return <section className="fw-game-options"><SectionTitle leaf>夥伴與介面</SectionTitle>{ready ? <>
    <div className="fw-option-row"><div><strong>顯示夥伴與任務</strong><p>讓蔬果朋友陪你一起逛行情</p></div><Switch label="顯示夥伴與任務" checked={state.enabled} onChange={(enabled) => setOptions({ enabled })} /></div>
    <div className="fw-option-row"><div><strong>減少動態</strong><p>收起角色呼吸與介面過場</p></div><Switch label="減少動態" checked={state.reduceMotion} onChange={(reduceMotion) => setOptions({ reduceMotion })} /></div>
    <div className="fw-option-row"><div><strong>簡潔模式</strong><p>縮小場景，專心查價和整理菜籃</p></div><Switch label="簡潔模式" checked={state.compact} onChange={(compact) => setOptions({ compact })} /></div>
    <p className="fw-helper-note">{storageAvailable ? "夥伴與介面偏好保存在這台裝置。" : "瀏覽器目前無法保存進度，關閉後可能無法保留。"}</p>
  </> : <p className="fw-helper-note">正在讀取夥伴偏好…</p>}</section>;
}
export function QuestSlip({ all = false }: { all?: boolean }) {
  const { state, ready, claim } = useCompanion();
  if (!ready || !state.enabled) return null;
  const quests = all ? QUESTS : [QUESTS.find((q) => !state.claimed.includes(q.id)) ?? QUESTS[0]];
  return <section className="fw-quests" aria-label="今日探索任務">
    <h2><GameIcon name="water" size={48} />今日小任務<span>不需要購買食材</span></h2>
    {quests.map((quest) => { const progress = questProgress(state, quest.id); const claimed = state.claimed.includes(quest.id); const done = progress >= quest.target;
      return <div key={quest.id} className="fw-quest-row"><GameIcon name={quest.icon} size={36} /><div className="fw-quest-copy"><strong>{quest.title}</strong><p>{quest.description}</p><progress max={quest.target} value={progress} aria-label={`${quest.title}，${progress}／${quest.target}`} /></div><div className="fw-quest-action"><span><GameIcon name="dew" size={24} />+{quest.reward}</span>{claimed ? <span className="fw-quest-claimed">已領取</span> : done ? <button type="button" className="fw-leaf-link" onClick={() => claim(quest.id)}>領取</button> : <Link className="fw-leaf-link" href={quest.href}>{progress}／{quest.target} →</Link>}</div></div>;
    })}
  </section>;
}
