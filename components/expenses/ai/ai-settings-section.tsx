"use client";

import { useState } from "react";
import { Card, CardBody } from "../card";
import { ListCard } from "../list-row";
import { text } from "../theme";
import { useToast } from "../toast";
import { AiKeyModal } from "./ai-key-modal";
import { AiDraftsModal } from "./ai-drafts-modal";
import { maskKey, useAiKey } from "./use-ai-key";
import { draftSummaryLine, pendingItems, type AiDraftDTO } from "@/lib/expenses/ai-drafts";
import type { CategoryDTO } from "@/lib/expenses/categories";

/** 設定頁的「AI 記帳」整區——整個 AI 功能在設定頁的唯一接觸點。
 *
 *  三件事由上到下：開關、金鑰、待確認。順序是照「要用它之前要先做什麼」排的，不是照
 *  重要性——沒開開關的人後面兩項都用不到。
 *
 *  待確認放在設定頁而不是首頁：AI 是附屬功能，主要操作還是手動記帳。常駐在首頁會讓一個
 *  不常用的功能天天佔著第一屏；而「上次解析到一半跑掉了」這種事，回設定頁找是合理的。
 *  沒有待確認的批次時那一列整個不顯示。 */
export function AiSettingsSection({
  initialEnabled,
  initialDrafts,
  categories,
}: {
  initialEnabled: boolean;
  initialDrafts: AiDraftDTO[];
  categories: CategoryDTO[];
}) {
  const showToast = useToast();
  const { hasKey, key } = useAiKey();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [keyOpen, setKeyOpen] = useState(false);
  const [draftsOpen, setDraftsOpen] = useState(false);

  const pendingDrafts = drafts.filter((d) => d.status === "pending" && pendingItems(d).length > 0);

  async function toggle(next: boolean) {
    // 先動畫面再送出：這個開關純粹是顯示偏好，送失敗了最糟就是下次進來回到舊值，
    // 不值得讓使用者盯著一個卡住的開關等伺服器回應。
    setEnabled(next);
    const ok = await fetch("/api/expenses/ai/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiEnabled: next }),
    })
      .then((r) => r.ok)
      .catch(() => false);
    if (!ok) {
      setEnabled(!next);
      showToast("設定存不起來，再試一次");
    }
  }

  return (
    <div>
      <p className={`mb-2 px-1 ${text.label}`}>AI 記帳</p>
      <Card>
        <CardBody className="p-0">
          <label className="flex items-center gap-3 px-4 py-3.5">
            <span className="min-w-0 flex-1">
              <span className={`block ${text.body}`}>顯示 AI 記帳入口</span>
              <span className={`block ${text.muted}`}>打開後，明細與首頁右下角會多一顆按鈕，可以打一句話自動拆成好幾筆</span>
            </span>
            {/* 原生 checkbox 而不是自製開關：這一列就一個是非題，自己刻一顆滑動開關只是
                多一份要維護的互動，鍵盤與讀螢幕軟體還不一定吃得到。 */}
            <input type="checkbox" checked={enabled} onChange={(e) => toggle(e.target.checked)} className="size-5 shrink-0 accent-[#6F5ED4]" />
          </label>
        </CardBody>
      </Card>

      {enabled && (
        <div className="mt-2">
          <ListCard>
            <button type="button" onClick={() => setKeyOpen(true)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-[#F3EFFC]">
              <span className="min-w-0 flex-1">
                <span className={`block ${text.body}`}>OpenAI API Key</span>
                <span className={`block ${text.muted}`}>
                  {hasKey ? `已設定（${maskKey(key)}）· 只存在這台裝置` : "尚未設定 · 目前使用模擬解析"}
                </span>
              </span>
              <span className={text.faint}>›</span>
            </button>

            {pendingDrafts.length > 0 && (
              <button
                type="button"
                onClick={() => setDraftsOpen(true)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-[#F3EFFC]"
              >
                <span className="min-w-0 flex-1">
                  <span className={`block ${text.body}`}>待確認的解析結果</span>
                  <span className={`block ${text.muted}`}>{pendingDrafts.map(draftSummaryLine).join(" ／ ")}</span>
                </span>
                <span className="shrink-0 rounded-full bg-[#F3EFFC] px-2 py-0.5 text-xs font-semibold tabular-nums text-[#6F5FD6]">
                  {pendingDrafts.length}
                </span>
                <span className={text.faint}>›</span>
              </button>
            )}
          </ListCard>
        </div>
      )}

      <AiKeyModal open={keyOpen} onClose={() => setKeyOpen(false)} />
      <AiDraftsModal open={draftsOpen} drafts={drafts} categories={categories} onClose={() => setDraftsOpen(false)} onDraftsChange={setDrafts} />
    </div>
  );
}
