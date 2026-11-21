"use client";
import Link from "next/link";
import { useCompanion } from "./companion-store";
import { GameIcon } from "./game-art";
import { questProgress, QUESTS } from "@/lib/freshwise/companions";

export function DewBalance() { const { state, ready } = useCompanion(); return <Link href="/tools/freshwise/companions" className="fw-dew-balance" aria-label={ready ? `我的夥伴，目前有 ${state.dew} 露珠` : "我的夥伴"}><GameIcon name="dew" size={30} /><span>{ready ? state.dew : "—"}</span></Link>; }
export function QuestSlip({ all = false }: { all?: boolean }) {
  const { state, ready, claim } = useCompanion();
  if (!ready) return null;
  const quests = all ? QUESTS : [QUESTS.find((q) => !state.claimed.includes(q.id)) ?? QUESTS[0]];
  return <section className={`fw-quests ${all ? "fw-quests-all" : "fw-quests-compact"}`} aria-label="今日探索任務">
    <div className="fw-quest-paper" aria-hidden="true"><span className="fw-quest-paper-top"/><span className="fw-quest-paper-middle"/><span className="fw-quest-paper-bottom"/></div>
    <h2>今日小任務</h2>
    {quests.map((quest) => { const progress = questProgress(state, quest.id); const claimed = state.claimed.includes(quest.id); const done = progress >= quest.target;
      const reward = <><GameIcon name="dew" size={26} /><span>+{quest.reward}</span></>;
      return <div key={quest.id} className="fw-quest-row"><GameIcon name={all ? quest.icon : "water"} size={36} /><div className="fw-quest-copy"><strong>{all ? quest.title : quest.description}</strong>{all && <p>{quest.description}</p>}</div><div className="fw-quest-meter"><span>{progress}／{quest.target}</span><progress max={quest.target} value={progress} aria-label={`${quest.title}，${progress}／${quest.target}`} /></div><div className="fw-quest-action">{claimed ? <span className="fw-quest-reward">{reward}<small>已領取</small></span> : done ? <button type="button" className="fw-quest-reward" aria-label={`領取${quest.title}獎勵 ${quest.reward}露珠`} onClick={() => claim(quest.id)}>{reward}<small>領取</small></button> : <Link className="fw-quest-reward" href={quest.href} aria-label={`前往${quest.title}，獎勵 ${quest.reward}露珠`}>{reward}</Link>}</div></div>;
    })}
  </section>;
}
