"use client";

import { useEffect, useState } from "react";
import type { Mode } from "./stations-data";

interface PickerGroup {
  id: string;
  name: string;
}

/** 搜尋結果頁「加入行程」用的輕量選單：列出目前車種底下使用者自己建立的分類，外加一個
 *  「新增分類」。這裡故意不重用 FrequentTripModal（那個是編輯一整份分類的完整表單），
 *  收藏這個動作只需要「選一個分類」或「取個新分類名稱」，不需要再跳一次完整編輯畫面。 */
export function TripGroupPickerModal({
  open,
  mode,
  onClose,
  onSelectGroup,
  onCreateGroup,
}: {
  open: boolean;
  mode: Mode;
  onClose: () => void;
  onSelectGroup: (groupId: string) => void;
  onCreateGroup: (name: string) => void;
}) {
  const [groups, setGroups] = useState<PickerGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // 每次打開（或換車種）都要重新查，故意同步把上一次的結果清掉讓畫面回到查詢中狀態，
    // 不是在訂閱外部事件、也不會連鎖觸發其他 effect，屬於這個規則容許的例外。
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setLoading(true);
    fetch("/api/transit/trip-groups")
      .then((res) => res.json())
      .then((data: { groups?: { id: string; mode: string; name: string }[] }) => {
        if (cancelled) return;
        setGroups((data.groups ?? []).filter((g) => g.mode === mode).map((g) => ({ id: g.id, name: g.name })));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, mode]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 sm:items-center" onClick={onClose}>
      <div
        className="flex w-full max-w-[400px] flex-col rounded-t-[1.75rem] bg-white sm:rounded-[1.75rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#ECE4FA] px-5 py-4">
          <p className="font-semibold text-[#4A3B7C]">加入行程分類</p>
          <button type="button" onClick={onClose} aria-label="關閉" className="grid size-8 place-items-center rounded-full text-[#9C94C4] hover:bg-[#F3EFFC]">
            ✕
          </button>
        </div>

        <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="py-4 text-center text-xs text-[#B3ABD4]">載入中…</p>
          ) : (
            groups.length === 0 &&
            !creating && <p className="py-2 text-xs text-[#B3ABD4]">這個車種還沒有任何分類，新增一個吧</p>
          )}

          {!loading &&
            groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onSelectGroup(g.id)}
                className="rounded-2xl border border-[#ECE4FA] px-4 py-3 text-left text-sm font-medium text-[#4A3B7C] hover:bg-[#F3EFFC]"
              >
                {g.name}
              </button>
            ))}

          {creating ? (
            <>
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(false);
                }}
                placeholder="分類名稱"
                className={`rounded-2xl border bg-white px-4 py-3 text-sm font-medium text-[#4A3B7C] outline-none focus:border-[#6F5FD6] ${
                  nameError ? "border-[#D1517E]" : "border-[#ECE4FA]"
                }`}
              />
              {nameError && <span className="text-xs text-[#D1517E]">這個車種已經有同名的分類了</span>}
            </>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="rounded-xl border border-dashed border-[#C7BFE6] py-2.5 text-sm font-medium text-[#6F5FD6]"
            >
              ＋ 新增分類
            </button>
          )}
        </div>

        {/* 「新增並加入」跟其他彈窗的「儲存」一樣，獨立一個區塊放在最下方，不跟輸入框擠在
            同一排。 */}
        {creating && (
          <div className="flex items-center justify-end gap-2 border-t border-[#ECE4FA] px-5 py-4">
            <button type="button" onClick={() => setCreating(false)} className="px-4 py-2 text-sm text-[#9C94C4] hover:text-[#6F5FD6]">
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                const trimmed = name.trim();
                if (!trimmed) return;
                if (groups.some((g) => g.name.trim().toLowerCase() === trimmed.toLowerCase())) {
                  setNameError(true);
                  return;
                }
                onCreateGroup(trimmed);
              }}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(111,95,214,0.6)]"
              style={{ background: "linear-gradient(90deg, #8A7CEE, #6F5FD6)" }}
            >
              新增並加入
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
