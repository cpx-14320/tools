"use client";

import { useEffect, useState } from "react";
import type { Mode } from "./stations-data";
import { EditorSheet } from "./editor-sheet";
import { AddButton, ErrorText, Hint, TextInput } from "./ui";
import { copy } from "./theme";
import { SkeletonBar } from "./skeleton";
import { loadSkeletonCount, saveSkeletonCount } from "./skeleton-count";

interface PickerGroup {
  id: string;
  name: string;
}

// 這個車種上次實際有幾個分類——骨架列數照這個猜，不要固定寫死（設計系統規定骨架數量
// 要跟載入完的實際數量一致）。
const groupCountKey = (mode: Mode) => `cpx-tools:transit:trip-groups-count:${mode}`;

/** 搜尋結果頁「加入行程」用的輕量選單：列出目前車種底下使用者自己建立的分類，外加一個
 *  「新增分類」。這裡故意不重用 FrequentTripModal（那個是編輯一整份分類的完整表單），
 *  加入行程這個動作只需要「選一個分類」或「取個新分類名稱」，不需要再跳一次完整編輯畫面。 */
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
  const [skeletonCount, setSkeletonCount] = useState(0);

  useEffect(() => {
    // 掛載後才讀得到 localStorage（伺服器端渲染那一次沒有，初始值要跟瀏覽器端一致才不會
    // hydration 不匹配）。
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setSkeletonCount(loadSkeletonCount(groupCountKey(mode), 0));
  }, [mode]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // 每次打開（或換車種）都要重新查，故意同步把上一次的結果清掉讓畫面回到載入中狀態，
    // 不是在訂閱外部事件、也不會連鎖觸發其他 effect，屬於這個規則容許的例外。
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setLoading(true);
    fetch("/api/transit/trip-groups")
      .then((res) => res.json())
      .then((data: { groups?: { id: string; mode: string; name: string }[] }) => {
        if (cancelled) return;
        const forMode = (data.groups ?? []).filter((g) => g.mode === mode).map((g) => ({ id: g.id, name: g.name }));
        setGroups(forMode);
        saveSkeletonCount(groupCountKey(mode), forMode.length);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, mode]);

  function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (groups.some((g) => g.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      setNameError(true);
      return;
    }
    onCreateGroup(trimmed);
  }

  return (
    <EditorSheet
      open={open}
      title={`加入${copy.tripItem}`}
      onClose={onClose}
      // 還沒按「新增分類」時底部不需要主要按鈕——點分類本身就是確認動作了，多一顆「儲存」
      // 反而讓人以為要先選再按才算完成。
      onSave={creating ? create : undefined}
      saveLabel="新增並加入"
    >
      {loading ? (
        skeletonCount === 0 ? (
          <Hint>{copy.loading}</Hint>
        ) : (
          // 骨架列數＝上次這個車種實際的分類數，列高也跟下面真正的分類按鈕一致。
          <div className="flex flex-col gap-2">
            {Array.from({ length: skeletonCount }, (_, i) => (
              <div key={i} className="rounded-2xl border border-[#ECE4FA] px-4 py-3">
                <SkeletonBar width={`${40 + ((i * 17) % 30)}%`} height={14} />
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          {groups.length === 0 && !creating && <Hint>這個車種還沒有任何{copy.group}，新增一個吧</Hint>}

          {groups.length > 0 && (
            <div className="flex flex-col gap-2">
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onSelectGroup(g.id)}
                  className="rounded-2xl border border-[#ECE4FA] px-4 py-3 text-left text-sm font-medium text-[#4A3B7C] transition-colors hover:bg-[#F3EFFC]"
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}

          {creating ? (
            <>
              <TextInput
                type="text"
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError(false);
                }}
                placeholder={`${copy.group}名稱`}
                className={nameError ? "border-[#D1517E]" : ""}
              />
              {nameError && <ErrorText>這個車種已經有同名的{copy.group}了</ErrorText>}
            </>
          ) : (
            <AddButton onClick={() => setCreating(true)}>新增{copy.group}</AddButton>
          )}
        </>
      )}
    </EditorSheet>
  );
}
