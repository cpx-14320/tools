"use client";
import Link from "next/link";
import { useCompanion } from "./companion-store";
import { GameIcon } from "./game-art";
import { MeterBar } from "./ui";
import { questProgress, QUESTS } from "@/lib/freshwise/companions";

export function DewBalance() { const { state, ready } = useCompanion(); return <Link href="/tools/freshwise/companions" className="fw-dew-balance" aria-label={ready ? `我的夥伴，目前有 ${state.dew} 露珠` : "我的夥伴"}><GameIcon name="dew" size={30} /><span>{ready ? state.dew : "—"}</span></Link>; }
/**
 * `variant`：
 * - `slip`（預設）首頁與夥伴頁的手撕紙條外觀。
 * - `paper` 菜籃頁與行情詳情頁用——那兩頁滿版都是標準紙卡，再插一張不同材質的紙會
 *   看起來像外來的東西。改掛 .fw-paper 跟隔壁的卡片同一張紙。
 */
export function QuestSlip({ all = false, variant = "slip" }: { all?: boolean; variant?: "slip" | "paper" }) {
  const { state, ready, claim } = useCompanion();
  if (!ready) return null;
  const quests = all ? QUESTS : [QUESTS.find((q) => !state.claimed.includes(q.id)) ?? QUESTS[0]];
  return <section className={`fw-quests ${all ? "fw-quests-all" : "fw-quests-compact"} ${variant === "paper" ? "fw-quests-paper" : ""}`} aria-label="今日探索任務">
    <h2>今日小任務</h2>
    {quests.map((quest) => { const progress = questProgress(state, quest.id); const claimed = state.claimed.includes(quest.id); const done = progress >= quest.target;
      const reward = <><GameIcon name="dew" size={26} /><span>+{quest.reward}</span></>;
      return <div key={quest.id} className="fw-quest-row"><GameIcon name={all ? quest.icon : "water"} size={all ? 36 : 56} /><div className="fw-quest-copy"><strong>{quest.title}</strong><p>{quest.description}</p><MeterBar value={progress} max={quest.target} label={`${progress}／${quest.target}`} ariaLabel={`${quest.title}，${progress}／${quest.target}`} /></div><div className="fw-quest-action">{claimed ? <span className="fw-quest-reward">{reward}<small>已領取</small></span> : done ? <button type="button" className="fw-quest-reward" aria-label={`領取${quest.title}獎勵 ${quest.reward}露珠`} onClick={() => claim(quest.id)}>{reward}<small>領取</small></button> : <Link className="fw-quest-reward" href={quest.href} aria-label={`前往${quest.title}，獎勵 ${quest.reward}露珠`}>{reward}</Link>}</div></div>;
    })}
  </section>;
}
