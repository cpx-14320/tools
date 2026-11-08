"use client";

import { useEffect, useRef, useState } from "react";

/** Web Speech API 的型別不在 TypeScript 的標準 DOM 定義裡（它還是非標準規格），所以這裡
 *  自己宣告會用到的那幾個欄位，不要整個 any 掉——至少 onresult 拿到的東西有型別可查。 */
interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** 語音輸入——按一下開始收音，再按一下（或瀏覽器自己判定講完）結束，把整段辨識結果
 *  交給呼叫端接進輸入框。
 *
 *  用瀏覽器內建的 Web Speech API，不經過我們的伺服器、也不用 OpenAI 的 API key，所以
 *  沒有額外費用。代價是支援度看瀏覽器：Chrome／Edge／Android Chrome 可以，iOS Safari
 *  時好時壞。偵測不到就回 supported: false，呼叫端要把按鈕整顆藏起來——按了沒反應比
 *  沒有這顆按鈕更糟。
 *
 *  **continuous: true**：一句話記好幾筆帳（「午餐 120，晚上電影 350」）中間一定會停頓，
 *  預設模式一停頓就結束，後半句會被吃掉。改成持續聆聽、由使用者自己按停止。
 *
 *  辨識結果累積在 ref 裡、等結束才一次吐出去：邊講邊往輸入框裡塞的話，使用者同時在
 *  編輯那個框就會打架（游標被搶、剛改的字被覆蓋）。 */
export function useSpeechInput({ onResult, onError }: { onResult: (text: string) => void; onError?: (message: string) => void }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");
  // onResult／onError 放進 ref：它們通常是每次 render 都重新產生的 inline 函式，直接寫進
  // recognition 的 callback 會抓到建立當下那一份（過期的 state）。在 effect 裡更新而不是
  // render 時直接指派——render 階段碰 ref 是 React 明文禁止的。
  const handlersRef = useRef({ onResult, onError });
  useEffect(() => {
    handlersRef.current = { onResult, onError };
  });

  const [supported, setSupported] = useState(false);
  // 瀏覽器能力偵測放在 effect 裡：伺服器端沒有 window，直接在 render 時判斷會讓
  // SSR 跟首次 CSR 的輸出不一致（hydration 會抱怨按鈕憑空多出來）。
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setSupported(getCtor() !== null);
  }, []);

  // 離開畫面（彈窗關掉、換頁）時一定要停掉，不然麥克風會一直開著。
  useEffect(() => () => recognitionRef.current?.abort(), []);

  function start() {
    const Ctor = getCtor();
    if (!Ctor || listening) return;

    const recognition = new Ctor();
    recognition.lang = "zh-TW";
    recognition.continuous = true;
    recognition.interimResults = false;
    transcriptRef.current = "";

    recognition.onresult = (event) => {
      // 只收 isFinal 的片段；同一個 results 清單會重複帶出先前的結果，所以從 resultIndex
      // 開始取，不要整份重跑一次（會重複累加）。
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) transcriptRef.current += result[0].transcript;
      }
    };

    recognition.onerror = (event) => {
      setListening(false);
      const message =
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "沒有麥克風權限，請在瀏覽器設定裡允許"
          : event.error === "no-speech"
            ? "沒有聽到聲音，再試一次"
            : "收音失敗，再試一次";
      handlersRef.current.onError?.(message);
    };

    recognition.onend = () => {
      setListening(false);
      const text = transcriptRef.current.trim();
      if (text) handlersRef.current.onResult(text);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function stop() {
    // stop() 會讓它把最後一段辨識完再觸發 onend，不像 abort() 會直接丟掉。
    recognitionRef.current?.stop();
  }

  return { supported, listening, start, stop };
}
