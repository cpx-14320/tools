"use client";

import { useState } from "react";
import { Modal } from "../modal";
import { Button } from "../button";
import { ListCard } from "../list-row";
import { ConfirmModal } from "../confirm-modal";
import { TransactionModal, type TransactionModalDraft } from "../transaction-modal";
import { text } from "../theme";
import { useToast } from "../toast";
import { AiDraftList } from "./ai-draft-list";
import { useDraftEditData } from "./use-draft-edit-data";
import { draftSummaryLine, pendingItems, unclassifiedItems, type AiDraftDTO, type AiDraftItemDTO } from "@/lib/expenses/ai-drafts";
import type { CategoryDTO } from "@/lib/expenses/categories";
import { formatDate } from "@/lib/format";

/** 設定頁的「待確認的解析結果」——先看有哪幾批，點進去處理其中一批。
 *
 *  兩層而不是一層：同一句話重跑兩次會產生兩批很像的結果，直接把所有項目混在一起列的話
 *  根本分不出哪筆屬於哪次解析，更不可能判斷「哪一批已經處理過了」。批次是這個功能的
 *  基本單位，介面要照著它走。 */
export function AiDraftsModal({
  open,
  drafts,
  categories,
  onClose,
  onDraftsChange,
}: {
  open: boolean;
  drafts: AiDraftDTO[];
  categories: CategoryDTO[];
  onClose: () => void;
  onDraftsChange: (drafts: AiDraftDTO[]) => void;
}) {
  const showToast = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AiDraftItemDTO | null>(null);
  const [discardId, setDiscardId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 編輯一筆草稿要用到帳戶、交易、轉帳（新增／編輯彈窗裡的帳戶選擇要顯示餘額）。
  // 這些刻意不從設定頁的 Server Component 傳下來——那會讓每次進設定頁都多載一份完整的
  // 交易清單（量過大約 80KB），只為了一個多數時候不會打開的彈窗。改成真的打開才抓。
  const editData = useDraftEditData(openId !== null, categories);

  const current = openId ? (drafts.find((d) => d.id === openId) ?? null) : null;
  const pendingDrafts = drafts.filter((d) => d.status === "pending" && pendingItems(d).length > 0);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    const data: { drafts?: AiDraftDTO[]; count?: number; error?: string } = await fetch("/api/expenses/ai/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .catch(() => ({}));
    setBusy(false);
    if (data.drafts) onDraftsChange(data.drafts);
    return data;
  }

  async function patchItem(key: string, patch: Record<string, unknown>) {
    if (!current) return;
    const data: { draft?: AiDraftDTO } = await fetch("/api/expenses/ai/drafts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId: current.id, key, ...patch }),
    })
      .then((r) => r.json())
      .catch(() => ({}));
    if (data.draft) onDraftsChange(drafts.map((d) => (d.id === data.draft!.id ? data.draft! : d)));
  }

  // ── 第二層：處理其中一批 ──────────────────────────────────────────────────
  if (current) {
    const pending = pendingItems(current);
    const unclassified = unclassifiedItems(current);
    return (
      <>
        <Modal
          open={open}
          onClose={() => setOpenId(null)}
          title="待確認"
          fullHeight
          footer={
            <div className="flex w-full items-center justify-between gap-2">
              <button type="button" onClick={() => setDiscardId(current.id)} className="text-xs font-medium text-[#D1517E]">
                整批捨棄
              </button>
              <Button
                disabled={busy || pending.length === 0 || unclassified.length > 0}
                onClick={async () => {
                  const data = await post({ action: "commit", draftId: current.id });
                  if (data.drafts) {
                    showToast(`已寫入 ${data.count ?? 0} 筆`);
                    setOpenId(null);
                  }
                }}
              >
                {busy ? "寫入中…" : `寫入 ${pending.length} 筆`}
              </Button>
            </div>
          }
        >
          <div>
            <p className={text.sectionHeading}>「{current.inputSummary}」</p>
            <p className={`mt-0.5 ${text.faint}`}>
              {formatDate(current.createdAt.slice(0, 10))} · {current.model === "mock" ? "模擬解析" : current.model} · {draftSummaryLine(current)}
            </p>
          </div>

          <AiDraftList
            draft={current}
            categories={categories}
            onEdit={setEditing}
            onSkip={(item) => patchItem(item.key, { state: "skipped" })}
          />

          {unclassified.length > 0 && (
            <p className="rounded-2xl bg-[#FDF4E7] px-4 py-3 text-xs leading-relaxed text-[#9A7430]">
              還有 {unclassified.length} 筆沒分類，點那一列補上之後才能寫入。不想記的話按「略過」。
            </p>
          )}

          {/* 編輯用的是記帳本原本那個新增／編輯彈窗（跟 AI 記帳彈窗裡同一個），分類、
              名稱、日期、金額、帳戶全都能改，而且值已經帶好。 */}
          <TransactionModal
            key={editing ? editing.key : "closed"}
            open={editing !== null}
            title="確認這一筆"
            confirmLabel="改好了"
            categories={editData.categories}
            accounts={editData.accounts}
            accountTypes={editData.accountTypes}
            transactions={editData.transactions}
            transfers={editData.transfers}
            defaultKind="支出"
            initial={
              editing
                ? {
                    categoryId: editing.categoryId ?? "",
                    amount: editing.amount,
                    date: editing.date,
                    note: editing.note,
                    accountId: editing.accountId,
                  }
                : undefined
            }
            onClose={() => setEditing(null)}
            onSave={(next: TransactionModalDraft) => {
              if (editing) {
                patchItem(editing.key, {
                  categoryId: next.categoryId,
                  amount: next.amount,
                  date: next.date,
                  note: next.note ?? null,
                  accountId: next.accountId ?? null,
                });
              }
              setEditing(null);
            }}
            onCategoriesChange={editData.setCategories}
          />
        </Modal>

        <ConfirmModal
          open={discardId !== null}
          title="整批捨棄"
          message="這一批解析結果會整批標成不處理，不會寫進消費紀錄。已經寫入的那幾筆不受影響。"
          confirmLabel="捨棄這一批"
          onConfirm={async () => {
            await post({ action: "discard", draftId: current.id });
            setOpenId(null);
          }}
          onClose={() => setDiscardId(null)}
        />
      </>
    );
  }

  // ── 第一層：有哪幾批 ─────────────────────────────────────────────────────
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="待確認的解析結果"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <button
            type="button"
            onClick={async () => {
              const data = await post({ action: "clearClosed" });
              if (data.drafts) showToast(`已清掉 ${data.count ?? 0} 批`);
            }}
            className="text-xs font-medium text-[#9C94C4]"
          >
            清掉已處理的
          </button>
          <Button variant="ghost" onClick={onClose}>
            關閉
          </Button>
        </div>
      }
    >
      {pendingDrafts.length === 0 ? (
        <p className={`px-1 ${text.faint}`}>目前沒有待確認的解析結果。</p>
      ) : (
        <>
          <p className={`${text.muted} leading-relaxed`}>
            每一批是一次解析的結果。點進去補分類、略過不要的，再一次寫進消費紀錄。
          </p>
          <ListCard>
            {pendingDrafts.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setOpenId(d.id)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-[#F3EFFC]"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#F3EFFC] text-sm">{d.source === "csv" ? "📄" : "💬"}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate ${text.body}`}>{d.inputSummary}</span>
                  <span className={`block ${text.muted}`}>
                    {formatDate(d.createdAt.slice(0, 10))} · {draftSummaryLine(d)}
                  </span>
                </span>
                {unclassifiedItems(d).length > 0 && (
                  <span className="shrink-0 rounded-full bg-[#FDF4E7] px-2 py-0.5 text-xs font-semibold text-[#9A7430]">待分類</span>
                )}
                <span className={text.faint}>›</span>
              </button>
            ))}
          </ListCard>
        </>
      )}
    </Modal>
  );
}
