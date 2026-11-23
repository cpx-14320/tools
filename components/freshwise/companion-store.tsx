"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  careForCompanion,
  claimCompanionQuest,
  companionDay,
  COMPANION_STORAGE_KEY,
  dailyState,
  initialCompanionState,
  QUESTS,
  QUEST_STAMP_REWARD,
  questProgress,
  recordCompanionEvent,
  selectCompanion,
  type CompanionEvent,
  type CompanionId,
  type CompanionState,
  type QuestId,
} from "@/lib/freshwise/companions";
import Link from "next/link";
import { BottomSheetModal } from "./bottom-sheet-modal";
import { GameIcon, PetArtwork } from "./game-art";

// 夥伴養成的前端狀態。
//
// **進度存在帳號底下，不是瀏覽器底下**（`/api/freshwise/companion`）。換裝置、換瀏覽器、
// 清快取都不會掉等級；同一台電腦換帳號登入看到的也是各自的夥伴。
//
// 畫面不等伺服器：每個動作先用 companions.ts 的純函式在本地算一次（樂觀更新），再把
// 「發生了什麼事」送上去，回應到了以伺服器算出來的為準。伺服器跑的是同一組函式，正常
// 情況下兩邊結果一樣，使用者不會看到數字跳動；不一樣的時候（例如另一台裝置剛領過獎）
// 以伺服器為準才是對的。
//
// 瀏覽事件（看了哪個品項）會在短時間內攢成一批再送，不然在清單上點來點去會變成一個
// 動作一個請求。

interface CompanionContextValue {
  state: CompanionState;
  ready: boolean;
  /** 進度存不存得起來。連不上 API 時為 false，畫面會提示這次的進度不會被保存。 */
  storageAvailable: boolean;
  record: (event: CompanionEvent) => void;
  claim: (id: QuestId) => void;
  care: (action: "water" | "play") => void;
  select: (id: CompanionId) => void;
  reset: () => void;
}

const Context = createContext<CompanionContextValue | null>(null);
const API = "/api/freshwise/companion";
/** 瀏覽事件攢多久再送。夠短到離開頁面前會送出，夠長到連點幾個品項只會有一個請求。 */
const FLUSH_MS = 1200;

export function CompanionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(() => initialCompanionState(""));
  const [ready, setReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [reward, setReward] = useState<QuestId | null>(null);
  const [message, setMessage] = useState("");

  const current = useRef(state);
  const readyRef = useRef(false);
  /** 還沒載入完就發生的事件先排隊，載入完一起補算。 */
  const pending = useRef<CompanionEvent[]>([]);
  /** 已經在本地算過、還沒送到伺服器的瀏覽事件。 */
  const unsent = useRef<CompanionEvent[]>([]);
  const flushTimer = useRef<number | null>(null);

  const apply = useCallback((next: CompanionState) => {
    current.current = next;
    setState(next);
  }, []);

  /** 送一個動作上去，並以伺服器回的狀態為準。送不出去就標記成「這次不會被保存」。 */
  const send = useCallback(
    async (body: Record<string, unknown>) => {
      try {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, today: companionDay() }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { state?: CompanionState };
        if (data.state) apply(data.state);
        setStorageAvailable(true);
      } catch {
        setStorageAvailable(false);
      }
    },
    [apply],
  );

  /** 把攢著的瀏覽事件送出去。回傳 Promise，因為「領獎」必須等它送完才能送——不然
   *  伺服器會先收到領獎、發現任務還沒達標而拒絕。 */
  const flush = useCallback(async () => {
    if (flushTimer.current !== null) {
      window.clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    if (unsent.current.length === 0) return;
    const events = unsent.current;
    unsent.current = [];
    await send({ action: "events", events });
  }, [send]);

  useEffect(() => {
    let alive = true;

    async function boot() {
      const day = companionDay();
      let loaded = initialCompanionState(day);
      try {
        const res = await fetch(`${API}?today=${day}`);
        if (!res.ok) throw new Error(String(res.status));
        loaded = ((await res.json()) as { state: CompanionState }).state;

        // 一次性搬家：這台裝置上還留著舊版的 localStorage 進度，而雲端還是全新的，
        // 就把它交給伺服器（伺服器只在雲端真的沒有資料時才會採用）。搬完就清掉，
        // 之後這個 key 不再是任何資料的來源。
        const legacy = localStorage.getItem(COMPANION_STORAGE_KEY);
        if (legacy && loaded.stamps === 0 && loaded.xp === 0) {
          const res2 = await fetch(API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "migrate", raw: legacy, today: day }),
          });
          if (res2.ok) loaded = ((await res2.json()) as { state: CompanionState }).state;
        }
        if (legacy) localStorage.removeItem(COMPANION_STORAGE_KEY);
      } catch {
        if (alive) setStorageAvailable(false);
      }
      if (!alive) return;

      for (const event of pending.current) loaded = recordCompanionEvent(loaded, event, companionDay());
      const queued = pending.current;
      pending.current = [];
      readyRef.current = true;
      apply(loaded);
      setReady(true);
      if (queued.length) {
        unsent.current.push(...queued);
        void flush();
      }
    }

    void boot();

    // 回到這個分頁時重新跟伺服器對一次：可能已經跨日（任務要重置），也可能在另一台
    // 裝置上有了新進度。
    const refresh = () => {
      if (!readyRef.current) return;
      const rolled = dailyState(current.current, companionDay());
      if (rolled !== current.current) apply(rolled);
      void (async () => {
        try {
          const res = await fetch(`${API}?today=${companionDay()}`);
          if (res.ok) apply(((await res.json()) as { state: CompanionState }).state);
        } catch {
          /* 對帳失敗就先用本地的，下次再試 */
        }
      })();
    };
    window.addEventListener("focus", refresh);
    return () => {
      alive = false;
      readyRef.current = false;
      window.removeEventListener("focus", refresh);
      if (flushTimer.current !== null) window.clearTimeout(flushTimer.current);
    };
  }, [apply, flush]);

  // 離開頁面前把還沒送出的瀏覽事件補送。
  useEffect(() => {
    const onHide = () => {
      if (unsent.current.length === 0) return;
      const body = JSON.stringify({ action: "events", events: unsent.current, today: companionDay() });
      unsent.current = [];
      navigator.sendBeacon?.(API, new Blob([body], { type: "application/json" }));
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const record = useCallback(
    (event: CompanionEvent) => {
      if (!readyRef.current) {
        pending.current.push(event);
        return;
      }
      const next = recordCompanionEvent(current.current, event, companionDay());
      if (next === current.current) return; // 重複瀏覽同一項不算進度，也不用送
      apply(next);
      unsent.current.push(event);
      if (flushTimer.current !== null) window.clearTimeout(flushTimer.current);
      flushTimer.current = window.setTimeout(() => void flush(), FLUSH_MS);
    },
    [apply, flush],
  );

  /**
   * 打開任務的小紙條。**三種狀態都打得開**，還沒真的領。
   *
   * 以前按下去就直接記成已領取、順便開彈窗——使用者如果只是想看看獎勵是什麼、按了
   * 關閉，獎勵已經入帳而他沒看到那封信。真正入帳的動作是彈窗裡的「收下心意」
   * （confirmClaim）。
   *
   * 也不再限定「可以領的時候才打得開」：這張紙條同時是「完成這個任務會拿到什麼」的
   * 說明，還沒做完的時候最需要看。按鈕隨狀態換（去完成／收下心意／已領取），清單上
   * 那一格就只負責表示現在是哪一種狀態。
   */
  const claim = useCallback((id: QuestId) => {
    if (!readyRef.current) return;
    setReward(id);
  }, []);

  /** 小紙條上的「收下心意」：這一步才真的入帳。id 由呼叫端（彈窗）傳，它知道現在
   *  開的是哪一封信。 */
  const confirmClaim = useCallback((id: QuestId) => {
    setReward(null);
    if (!readyRef.current) return;
    const next = claimCompanionQuest(current.current, id, companionDay());
    if (next === current.current || current.current.claimed.includes(id)) return;
    apply(next);
    void (async () => {
      // 先把累積的瀏覽事件送完，伺服器才看得到任務已經達標。
      await flush();
      await send({ action: "claim", quest: id });
    })();
  }, [apply, flush, send]);

  const care = useCallback(
    (action: "water" | "play") => {
      if (!readyRef.current) return;
      const next = careForCompanion(current.current, action, companionDay());
      if (next.xp === current.current.xp) {
        setMessage(action === "water" ? "露珠不夠囉，和夥伴一起完成探索吧。" : "今天已經陪玩過了，明天再一起玩吧！");
        return;
      }
      apply(next);
      setMessage(action === "water" ? "收到你的澆水，成長 +3！" : "一起玩得好開心，成長 +2！");
      void send({ action: "care", care: action });
    },
    [apply, send],
  );

  const select = useCallback(
    (id: CompanionId) => {
      if (!readyRef.current) return;
      apply(selectCompanion(current.current, id));
      void send({ action: "select", id });
    },
    [apply, send],
  );

  const reset = useCallback(() => {
    apply(initialCompanionState(companionDay()));
    setReward(null);
    unsent.current = [];
    void send({ action: "reset" });
  }, [apply, send]);

  const quest = QUESTS.find((q) => q.id === reward);
  // 小紙條的三種樣子都從同一份狀態算，清單那一格與彈窗不會各說各話。
  const questClaimed = !!quest && state.claimed.includes(quest.id);
  const questDone = !!quest && questProgress(state, quest.id) >= quest.target;

  return (
    <Context.Provider value={{ state, ready, storageAvailable, record, claim, care, select, reset }}>
      {children}
      {message && (
        <div className="fw-game-toast" role="status">
          {message}
        </div>
      )}
      <BottomSheetModal open={!!reward} title="夥伴寄來的小紙條" onClose={() => setReward(null)} bodyClassName="fw-reward-letter">
        <PetArtwork id={state.active} size={200} ready={ready} />
        <h2>{questDone ? "又多一點買菜的把握！" : "還差一點點！"}</h2>
        <p>
          {questDone ? `「${quest?.title}」完成了。` : `「${quest?.title}」${quest?.description}`}
          <br />
          {questDone ? "謝謝你，陪我一起把行情看懂。" : "完成之後，這份心意就是你的。"}
        </p>
        <div className="fw-letter-rewards">
          <span>
            <GameIcon name="dew" />+{quest?.reward} 露珠
          </span>
          <span>
            <GameIcon name="book" />
            探索印章 +{QUEST_STAMP_REWARD}
          </span>
        </div>
        {questClaimed ? (
          <button type="button" className="fw-game-button" disabled>
            已經收下了
          </button>
        ) : questDone ? (
          <button type="button" className="fw-game-button" onClick={() => reward && confirmClaim(reward)}>
            收下心意，繼續探索
          </button>
        ) : (
          <Link className="fw-game-button" href={quest?.href ?? "/tools/freshwise"} onClick={() => setReward(null)}>
            去完成任務
          </Link>
        )}
      </BottomSheetModal>
    </Context.Provider>
  );
}

export function useCompanion() {
  const value = useContext(Context);
  if (!value) throw new Error("useCompanion 必須在 CompanionProvider 裡使用");
  return value;
}
