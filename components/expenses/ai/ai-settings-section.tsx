"use client";

import { useState } from "react";
import Link from "next/link";
import { Switch } from "../button";
import { IconAvatar } from "../icon-avatar";
import { ICON_PATHS } from "../icon-paths";
import { ListCard } from "../list-row";
import { text } from "../theme";
import { useToast } from "../toast";
import { AiKeyModal } from "./ai-key-modal";
import { maskKey, useAiKey } from "./use-ai-key";

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
  draftCount,
}: {
  initialEnabled: boolean;
  /** 還沒處理完的解析批次有幾批。清單本身是獨立的一頁（/more/ai-drafts），這裡只掛數字。 */
  draftCount: number;
}) {
  const showToast = useToast();
  const { hasKey, key } = useAiKey();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [keyOpen, setKeyOpen] = useState(false);

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
      {/* 三列收在同一張卡裡（跟首頁「預算支出」那張一樣：同一塊卡片裡是同一件事的幾個
          面向）。本來開關是一張卡、金鑰跟待確認另外一張，中間隔一段距離，看起來像兩個
          不相干的設定。
          第一列的排版跟上面那幾組功能入口一模一樣（36px 圖示＋標題／說明），差別只在
          最右邊：那幾組是「點進去」的 ›，這一列是「開或關」的滑動開關。整列都是
          <label>，點文字也能切換。
          關掉的時候後面兩列不顯示——沒開這個功能的人，金鑰跟待確認都用不到。 */}
      <ListCard>
        <label className="flex items-center gap-3 px-4 py-3.5">
          <IconAvatar icon={ICON_PATHS.settingAi} plain />
          <span className="min-w-0 flex-1">
            <span className={`block ${text.body}`}>顯示 AI 記帳入口</span>
            <span className={`block ${text.muted}`}>開啟 AI 按鈕，打一句話自動新增記帳</span>
          </span>
          <Switch checked={enabled} onChange={toggle} label="顯示 AI 記帳入口" />
        </label>

        {enabled && (
          <button type="button" onClick={() => setKeyOpen(true)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-[#F3EFFC]">
            {/* 只留標題跟右邊的狀態，下面不再掛一行小字：解釋「金鑰存在哪、怎麼用」
                的地方是點進去的彈窗，在清單上重複一次只是把這一區變長。 */}
            <IconAvatar icon={ICON_PATHS.aiKey} plain />
            <span className={`min-w-0 flex-1 ${text.body}`}>OpenAI API Key</span>
            <span className={`shrink-0 ${text.muted}`}>{hasKey ? maskKey(key) : "尚未設定"}</span>
            <span className={text.faint}>›</span>
          </button>
        )}

        {/* 跟上面幾組功能入口一樣是 <Link>：右邊那個 › 代表會換頁，而它現在真的會
            （/more/ai-drafts）。本來是開彈窗，點進去還要再疊第二層彈窗處理單一批次。 */}
        {enabled && draftCount > 0 && (
          <Link href="/tools/expenses/more/ai-drafts" className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-[#F3EFFC]">
            <IconAvatar icon={ICON_PATHS.aiDrafts} plain />
            <span className={`min-w-0 flex-1 ${text.body}`}>待確認的解析結果</span>
            <span className="shrink-0 rounded-full bg-[#F3EFFC] px-2 py-0.5 text-xs font-semibold tabular-nums text-[#6F5FD6]">{draftCount}</span>
            <span className={text.faint}>›</span>
          </Link>
        )}
      </ListCard>

      <AiKeyModal open={keyOpen} onClose={() => setKeyOpen(false)} />
    </div>
  );
}
