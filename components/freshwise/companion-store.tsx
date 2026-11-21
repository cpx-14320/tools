"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { careForCompanion, claimCompanionQuest, companionDay, COMPANION_STORAGE_KEY, dailyState, initialCompanionState, parseCompanionState, QUESTS, recordCompanionEvent, selectCompanion, type CompanionEvent, type CompanionId, type CompanionState, type QuestId } from "@/lib/freshwise/companions";
import { BottomSheetModal } from "./bottom-sheet-modal";
import { GameIcon, PetArtwork } from "./game-art";

interface CompanionContextValue {
  state: CompanionState; ready: boolean; storageAvailable: boolean;
  record: (event: CompanionEvent) => void;
  claim: (id: QuestId) => void;
  care: (action: "water" | "play") => void;
  select: (id: CompanionId) => void;
  setOptions: (patch: Partial<Pick<CompanionState, "enabled" | "compact" | "reduceMotion">>) => void;
  reset: () => void;
}
const Context = createContext<CompanionContextValue | null>(null);
export function CompanionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(() => initialCompanionState(""));
  const [ready, setReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [reward, setReward] = useState<QuestId | null>(null);
  const [message, setMessage] = useState("");
  const current = useRef(state);
  const readyRef = useRef(false);
  const pending = useRef<CompanionEvent[]>([]);
  const commit = useCallback((next: CompanionState) => {
    current.current = next;
    setState(next);
    try { localStorage.setItem(COMPANION_STORAGE_KEY, JSON.stringify(next)); }
    catch { setStorageAvailable(false); }
  }, []);
  /* eslint-disable react-hooks/set-state-in-effect -- 首次掛載讀取外部 localStorage，與原有菜籃的初始化方式一致。 */
  useEffect(() => {
    let loaded = initialCompanionState(companionDay());
    try { loaded = parseCompanionState(localStorage.getItem(COMPANION_STORAGE_KEY), companionDay()); }
    catch { setStorageAvailable(false); }
    for (const event of pending.current) loaded = recordCompanionEvent(loaded, event, companionDay());
    pending.current = [];
    readyRef.current = true;
    // 初始化只在掛載時讀取，避免伺服器與瀏覽器的畫面不一致。
    commit(loaded);
    setReady(true);
    const refreshDay = () => { const next = dailyState(current.current, companionDay()); if (next !== current.current) commit(next); };
    const sync = (event: StorageEvent) => { if (event.key === COMPANION_STORAGE_KEY) commit(parseCompanionState(event.newValue, companionDay())); };
    window.addEventListener("focus", refreshDay);
    window.addEventListener("storage", sync);
    return () => { readyRef.current = false; window.removeEventListener("focus", refreshDay); window.removeEventListener("storage", sync); };
  }, [commit]);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => { if (!message) return; const timer = window.setTimeout(() => setMessage(""), 3000); return () => window.clearTimeout(timer); }, [message]);
  const record = useCallback((event: CompanionEvent) => {
    if (!readyRef.current) { pending.current.push(event); return; }
    const next = recordCompanionEvent(current.current, event, companionDay());
    if (next !== current.current) commit(next);
  }, [commit]);
  const claim = useCallback((id: QuestId) => {
    if (!readyRef.current) return;
    const next = claimCompanionQuest(current.current, id, companionDay());
    if (next === current.current || !next.claimed.includes(id) || current.current.claimed.includes(id) && current.current.day === next.day) return;
    commit(next); setReward(id);
  }, [commit]);
  const care = useCallback((action: "water" | "play") => {
    if (!readyRef.current) return;
    const next = careForCompanion(current.current, action, companionDay());
    if (next.xp === current.current.xp) { setMessage(action === "water" ? "露珠不夠囉，和夥伴一起完成探索吧。" : "今天已經陪玩過了，明天再一起玩吧！"); return; }
    commit(next); setMessage(action === "water" ? "收到你的澆水，成長 +3！" : "一起玩得好開心，成長 +2！");
  }, [commit]);
  const select = useCallback((id: CompanionId) => {
    if (!readyRef.current) return;
    commit(selectCompanion(current.current, id));
  }, [commit]);
  const setOptions = useCallback((patch: Partial<Pick<CompanionState, "enabled" | "compact" | "reduceMotion">>) => { if (readyRef.current) commit({ ...current.current, ...patch }); }, [commit]);
  const quest = QUESTS.find((q) => q.id === reward);
  const reset = useCallback(() => { commit(initialCompanionState(companionDay())); setReward(null); }, [commit]);
  return <Context.Provider value={{ state, ready, storageAvailable, record, claim, care, select, setOptions, reset }}>
    {children}
    {message && <div className="fw-game-toast" role="status">{message}</div>}
    <BottomSheetModal open={!!reward} title="夥伴寄來的小紙條" onClose={() => setReward(null)} bodyClassName="fw-reward-letter">
      <PetArtwork id={state.active} size={128} />
      <h2>又多一點買菜的把握！</h2>
      <p>「{quest?.title}」完成了。<br />謝謝你，陪我一起把行情看懂。</p>
      <div className="fw-letter-rewards"><span><GameIcon name="dew" />+{quest?.reward} 露珠</span><span><GameIcon name="book" />探索印章 +1</span></div>
      <button type="button" className="fw-game-button" onClick={() => setReward(null)}>收下心意，繼續探索</button>
      <small>已保存這次獎勵，不必重複操作。</small>
    </BottomSheetModal>
  </Context.Provider>;
}
export function useCompanion() { const value = useContext(Context); if (!value) throw new Error("useCompanion 必須在 CompanionProvider 裡使用"); return value; }
