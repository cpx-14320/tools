"use client";

import { useState } from "react";
import { Modal, Field, fieldInputClass } from "../modal";
import { Button } from "../button";
import { text } from "../theme";
import { maskKey, useAiKey } from "./use-ai-key";

/** 貼 OpenAI 金鑰的彈窗。
 *
 *  三句說明是這個彈窗最重要的部分，不是裝飾：使用者正要把一把能花自己錢的憑證交出去，
 *  「存在哪、誰看得到、花誰的錢、沒有的話去哪拿」四件事必須在按下儲存之前就講完。 */
export function AiKeyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { key, ready } = useAiKey();
  // key 綁在「開關狀態＋目前的金鑰」上＝每次打開都重新掛載一份乾淨的內容：輸入框從現值
  // 開始、「顯示」收回去。用 useEffect 去同步那兩個 state 也做得到，但那是「把可以靠
  // 重新掛載解決的事寫成副作用」，React 的 lint 規則擋的正是這種寫法。
  // ready 也進 key：SSR 那一輪還讀不到 localStorage，讀到之後要讓輸入框跟著帶出現值。
  return <AiKeyModalBody key={open ? `open-${ready}-${key}` : "closed"} open={open} onClose={onClose} />;
}

function AiKeyModalBody({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { key, hasKey, save, clear } = useAiKey();
  const [draft, setDraft] = useState(key);
  const [reveal, setReveal] = useState(false);

  const canSave = draft.trim().length > 0 && draft.trim() !== key;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="OpenAI API Key"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {hasKey ? (
            <button
              type="button"
              onClick={() => {
                clear();
                setDraft("");
              }}
              className="text-xs font-medium text-[#D1517E]"
            >
              清除金鑰
            </button>
          ) : (
            <span />
          )}
          <Button
            disabled={!canSave}
            onClick={() => {
              save(draft);
              onClose();
            }}
          >
            儲存
          </Button>
        </div>
      }
    >
      {/* 目前狀態擺最上面：打開這個彈窗的人第一個想知道的是「我到底設了沒」。 */}
      <div className={`flex items-center gap-2 rounded-2xl px-4 py-3 ${hasKey ? "bg-[#EAF7F1]" : "bg-[#FDF4E7]"}`}>
        <span className={`size-2 shrink-0 rounded-full ${hasKey ? "bg-[#2FAE82]" : "bg-[#E0A33E]"}`} />
        <span className={text.body}>{hasKey ? `已設定（${maskKey(key)}）` : "尚未設定，AI 記帳暫時不能用"}</span>
      </div>

      <Field label="貼上 API Key">
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            // type 跟著「顯示」切換而不是永遠 password：貼錯一個字元要能自己看出來，
            // 不然只能整串刪掉重貼。
            type={reveal ? "text" : "password"}
            placeholder="sk-..."
            autoComplete="off"
            spellCheck={false}
            className={`${fieldInputClass} min-w-0 flex-1 font-mono`}
          />
          <button type="button" onClick={() => setReveal((v) => !v)} className="shrink-0 text-xs font-medium text-[#6F5FD6]">
            {reveal ? "隱藏" : "顯示"}
          </button>
        </div>
      </Field>

      <ul className={`flex list-disc flex-col gap-1.5 pl-4 ${text.faint} leading-relaxed`}>
        <li>
          金鑰只存在<span className="font-semibold text-[#4A3B7C]">這台裝置的瀏覽器</span>
          ，每次用到 AI 時才隨請求送出，伺服器不會留。換裝置或清掉瀏覽器資料要重貼一次。
        </li>
        <li>費用直接算在你自己的 OpenAI 帳戶上，這個工具不會另外收費。</li>
        <li>
          還沒有金鑰？到{" "}
          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="font-medium text-[#6F5FD6] underline">
            OpenAI API Keys
          </a>{" "}
          建立一組，記得確認帳戶還有可用額度。
        </li>
        <li>你輸入的文字會送到 OpenAI 進行判讀，敏感內容請自行斟酌。</li>
      </ul>

      {/* 現在還沒接真模型，講清楚比讓人貼了金鑰之後才發現沒用好。 */}
      <p className={`rounded-2xl bg-[#F9F7FE] px-4 py-3 ${text.muted} leading-relaxed`}>
        目前還在接模型，先用<span className="font-semibold text-[#4A3B7C]">模擬解析</span>
        跑整套流程——不用貼金鑰也能直接試，解析出來的結果一樣會進待確認區。
      </p>
    </Modal>
  );
}
