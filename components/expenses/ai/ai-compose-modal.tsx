"use client";

import { useState } from "react";
import { Modal } from "../modal";
import { Button, SegmentedControl } from "../button";
import { CategoryGridPicker } from "../category-grid-picker";
import { text } from "../theme";
import { useToast } from "../toast";
import { AiDraftList } from "./ai-draft-list";
import { useAiKey } from "./use-ai-key";
import { needsSubcategory, type CategoryDTO, type CategoryKind } from "@/lib/expenses/categories";
import { unclassifiedItems, type AiDraftDTO, type AiDraftItemDTO } from "@/lib/expenses/ai-drafts";
import type { TransactionDTO } from "@/lib/expenses/transactions";

/** AI 記帳的主彈窗：上面打一句話，解析完同一個彈窗往下長出待確認清單。
 *
 *  輸入跟確認放在同一個彈窗、不分兩頁，是因為這整件事該在十幾秒內結束——中間換頁會讓
 *  「我剛剛打了什麼」離開視線，而確認的時候最需要對照的就是原句。
 *
 *  解析結果一產生就已經存進資料庫了（見 /api/expenses/ai/parse），所以這個彈窗關掉、
 *  甚至整個瀏覽器關掉，那一批都還在，可以從設定頁的「AI 待確認」回來處理。 */
export function AiComposeModal({
  open,
  categories,
  onClose,
  onCommitted,
  onOpenKeyModal,
}: {
  open: boolean;
  categories: CategoryDTO[];
  onClose: () => void;
  /** 寫入成功後把最新的交易清單交回去，呼叫端更新自己的畫面。 */
  onCommitted: (transactions: TransactionDTO[]) => void;
  onOpenKeyModal: () => void;
}) {
  const showToast = useToast();
  const { hasKey } = useAiKey();
  const [kind, setKind] = useState<CategoryKind>("支出");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<AiDraftDTO | null>(null);
  /** 正在補分類的那一筆（null ＝ 沒有在補）。 */
  const [picking, setPicking] = useState<AiDraftItemDTO | null>(null);
  const [pickValue, setPickValue] = useState("");

  const unclassified = draft ? unclassifiedItems(draft) : [];
  const pending = draft?.items.filter((i) => i.state === "pending") ?? [];

  function reset() {
    setInput("");
    setDraft(null);
    setError(null);
    setPicking(null);
  }

  async function parse() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/expenses/ai/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input, kind }),
    }).catch(() => null);
    const data: { draft?: AiDraftDTO; error?: string; reused?: boolean } = (await res?.json().catch(() => ({}))) ?? {};
    setBusy(false);
    if (!data.draft) {
      setError(data.error ?? "解析失敗，再試一次");
      return;
    }
    setDraft(data.draft);
    if (data.reused) showToast("這段文字剛剛解析過了，直接沿用上一批");
  }

  async function patchItem(key: string, patch: Record<string, unknown>) {
    if (!draft) return;
    const data: { draft?: AiDraftDTO } = await fetch("/api/expenses/ai/drafts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId: draft.id, key, ...patch }),
    })
      .then((r) => r.json())
      .catch(() => ({}));
    if (data.draft) setDraft(data.draft);
  }

  async function commit() {
    if (!draft) return;
    setBusy(true);
    const data: { count?: number; transactions?: TransactionDTO[]; error?: string } = await fetch("/api/expenses/ai/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "commit", draftId: draft.id }),
    })
      .then((r) => r.json())
      .catch(() => ({}));
    setBusy(false);
    if (!data.transactions) {
      setError(data.error ?? "寫入失敗，再試一次");
      return;
    }
    onCommitted(data.transactions);
    showToast(`已寫入 ${data.count ?? 0} 筆`);
    reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="AI 記帳"
      fullHeight
      footer={
        draft ? (
          <div className="flex w-full items-center justify-between gap-2">
            <button type="button" onClick={reset} className="text-xs font-medium text-[#9C94C4]">
              重新輸入
            </button>
            <Button disabled={busy || pending.length === 0 || unclassified.length > 0} onClick={commit}>
              {busy ? "寫入中…" : `寫入 ${pending.length} 筆`}
            </Button>
          </div>
        ) : (
          <div className="flex w-full justify-end">
            <Button disabled={busy || input.trim().length === 0} onClick={parse}>
              {busy ? "解析中…" : "解析"}
            </Button>
          </div>
        )
      }
    >
      {!draft && (
        <>
          <SegmentedControl
            className="self-start"
            value={kind}
            onChange={setKind}
            options={[
              { value: "支出", label: "支出" },
              { value: "收入", label: "收入" },
            ]}
          />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={4}
            placeholder="午餐全家便當 120，晚上跟朋友看電影 350"
            className="w-full resize-none rounded-2xl border border-[#ECE4FA] bg-white px-4 py-3 text-sm text-[#4A3B7C] outline-none placeholder:text-[#B3ABD4] focus:border-[#6F5FD6]"
          />
          <p className={`${text.faint} leading-relaxed`}>
            一次最多 20 筆。用逗號或換行分開每一筆，日期可以講「昨天」「前天」，沒講就當作今天。
          </p>
          {/* 沒金鑰不擋著不讓用——目前本來就是模擬解析。但要讓人找得到設定的地方。 */}
          <button type="button" onClick={onOpenKeyModal} className={`self-start text-xs font-medium text-[#6F5FD6]`}>
            {hasKey ? "已設定 API Key，點這裡更換" : "目前是模擬解析 · 設定 API Key"}
          </button>
        </>
      )}

      {draft && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className={text.sectionHeading}>待確認 {pending.length} 筆</p>
            <span className={text.faint}>{draft.model === "mock" ? "模擬解析" : draft.model}</span>
          </div>
          <p className={`-mt-1 ${text.muted} leading-relaxed`}>「{draft.inputSummary}」</p>

          <AiDraftList
            draft={draft}
            categories={categories}
            onEdit={(item) => {
              setPicking(item);
              setPickValue(item.categoryId ?? "");
            }}
            onSkip={(item) => patchItem(item.key, { state: "skipped" })}
          />

          {unclassified.length > 0 && (
            <p className="rounded-2xl bg-[#FDF4E7] px-4 py-3 text-xs leading-relaxed text-[#9A7430]">
              還有 {unclassified.length} 筆沒分類，點那一列補上之後才能寫入。不想記的話按「略過」。
            </p>
          )}
        </>
      )}

      {error && <p className="rounded-2xl bg-[#FDEEF0] px-4 py-3 text-xs leading-relaxed text-[#D1517E]">{error}</p>}

      {/* 補分類：只列目前這個分頁的分類，跟批次改分類同一套規則。 */}
      <Modal open={picking !== null} onClose={() => setPicking(null)} title="這一筆算哪一類" fullHeight>
        <CategoryGridPicker
          categories={categories}
          kind={kind}
          value={pickValue}
          onChange={(categoryId) => {
            setPickValue(categoryId);
            if (needsSubcategory(categories, categoryId)) return;
            if (picking) patchItem(picking.key, { categoryId });
            setPicking(null);
          }}
        />
      </Modal>
    </Modal>
  );
}
