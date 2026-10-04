"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FrequentTripModal, type FrequentTripDraft } from "@/components/dream/frequent-trip-modal";
import { frequentTripIconPath } from "@/components/dream/frequent-trip-icons";
import { ImageSlot } from "@/components/dream/image-slot";
import { IconImg } from "@/components/dream/icon-img";
import { ICON_PATHS } from "@/components/dream/icon-paths";
import type { HomeDefaults } from "@/components/dream/home-settings-modal";

type Mode = "bus" | "train" | "metro" | "thsr";

// 分類名稱（例如「啟程」「返程」「假日出去玩」）完全由使用者自訂、自由新增，不是寫死的
// 兩種——每個分類是一份獨立的常用行程清單，使用者可以依車種各自新增任意多個分類。
// 四種車種（公車／火車／捷運／高鐵）都是同一套做法，不另外寫死任何假資料的歷史行程清單。
interface TripGroup {
  id: string;
  mode: Mode;
  name: string;
}

interface FrequentTrip extends FrequentTripDraft {
  id: string;
  mode: Mode;
  groupId: string;
}

const TABS: { key: Mode; label: string }[] = [
  { key: "bus", label: "公車" },
  { key: "train", label: "火車" },
  { key: "metro", label: "捷運" },
  { key: "thsr", label: "高鐵" },
];

// 跟首頁的「編輯首頁預設值」彈窗共用同一個 localStorage key，首頁存的預設運輸工具
// 這裡直接拿來當 tabs 預設選中的車種，不用另外存一份。
const HOME_DEFAULTS_KEY = "cpx-tools:transit:home-defaults";

function loadDefaultTab(): Mode | null {
  try {
    const raw = localStorage.getItem(HOME_DEFAULTS_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as HomeDefaults;
    return TABS.some((t) => t.key === saved.defaultMode) ? (saved.defaultMode as Mode) : null;
  } catch {
    return null;
  }
}

export function TripsView() {
  const router = useRouter();
  const [tab, setTab] = useState<Mode>("bus");
  // 分類（transit.tripGroups）跟分類底下的常用行程（transit.frequentTrips）各自一份
  // state，掛載時各抓一次使用者自己全部車種的清單，畫面上依目前選中的 tab 篩出對應清單
  // 顯示；新增/編輯/刪除分類或行程時用 API 回應直接更新對應那份 state。
  const [tripGroups, setTripGroups] = useState<TripGroup[]>([]);
  const [frequentTrips, setFrequentTrips] = useState<FrequentTrip[]>([]);
  // null＝彈窗關閉；groupId 為 null 代表正在新增一個全新分類，否則是在編輯該 id 的既有分類。
  const [groupModal, setGroupModal] = useState<{ groupId: string | null; name: string } | null>(null);
  const groupsForTab = tripGroups.filter((g) => g.mode === tab);

  // 進頁面時套用首頁設定的預設運輸工具，決定 tabs 預設停在哪個車種；跟首頁同一套做法，
  // 只在掛載時套用一次，之後使用者自己切換 tab 不會被這份預設值蓋回去。
  useEffect(() => {
    const defaultTab = loadDefaultTab();
    if (defaultTab) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setTab(defaultTab);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/transit/trip-groups")
      .then((res) => res.json())
      .then((data: { groups?: TripGroup[] }) => {
        if (!cancelled) setTripGroups(data.groups ?? []);
      })
      .catch(() => {});
    fetch("/api/transit/frequent-trips")
      .then((res) => res.json())
      .then((data: { trips?: FrequentTrip[] }) => {
        if (!cancelled) setFrequentTrips(data.trips ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // 分類名稱、底下的行程清單在同一個彈窗一次編輯：新增分類時先建立分類拿到 id，
  // 再用這個 id 把填好的行程存進去；編輯既有分類則是改名＋同步清單兩件事一起做。
  async function saveGroup(name: string, items: FrequentTripDraft[]) {
    if (!groupModal) return;

    if (groupModal.groupId) {
      const groupId = groupModal.groupId;
      if (name !== groupModal.name) {
        const renameData: { groups?: TripGroup[] } = await fetch("/api/transit/trip-groups", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: groupId, name }),
        })
          .then((res) => res.json())
          .catch(() => ({}));
        if (renameData.groups) setTripGroups(renameData.groups);
      }
      const tripsData: { trips?: FrequentTrip[] } = await fetch("/api/transit/frequent-trips", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: tab, groupId, items }),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (tripsData.trips) setFrequentTrips(tripsData.trips);
    } else {
      const createData: { group?: TripGroup; groups?: TripGroup[] } = await fetch("/api/transit/trip-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: tab, name }),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (!createData.group) {
        setGroupModal(null);
        return;
      }
      setTripGroups(createData.groups ?? []);
      if (items.length > 0) {
        const tripsData: { trips?: FrequentTrip[] } = await fetch("/api/transit/frequent-trips", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: tab, groupId: createData.group.id, items }),
        })
          .then((res) => res.json())
          .catch(() => ({}));
        if (tripsData.trips) setFrequentTrips(tripsData.trips);
      }
    }
    setGroupModal(null);
  }

  async function deleteGroup(groupId: string) {
    const data: { groups?: TripGroup[]; trips?: FrequentTrip[] } = await fetch(`/api/transit/trip-groups?id=${groupId}`, {
      method: "DELETE",
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.groups) setTripGroups(data.groups);
    if (data.trips) setFrequentTrips(data.trips);
    setGroupModal(null);
  }

  return (
    <div className="flex flex-col px-5 pb-6 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#4A3B7C]">我的行程</h1>
      </div>

      <FrequentTripModal
        key={groupModal ? `group-${groupModal.groupId ?? "new"}` : "group-closed"}
        open={groupModal !== null}
        mode={tab}
        initialName={groupModal?.name ?? ""}
        initial={groupModal ? frequentTrips.filter((f) => f.groupId === groupModal.groupId) : []}
        onClose={() => setGroupModal(null)}
        onSave={saveGroup}
        onDelete={groupModal?.groupId ? () => deleteGroup(groupModal.groupId as string) : undefined}
        isNameTaken={(candidate) =>
          tripGroups.some(
            (g) => g.mode === tab && g.id !== groupModal?.groupId && g.name.trim().toLowerCase() === candidate.trim().toLowerCase(),
          )
        }
      />

      <div className="mt-4 inline-flex items-center gap-1 self-start rounded-full bg-[#F3EFFC] p-1">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                active ? "bg-white text-[#6F5FD6] shadow-[0_2px_8px_-2px_rgba(111,95,214,0.4)]" : "text-[#9C94C4]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {groupsForTab.map((g) => {
        const groupTrips = frequentTrips.filter((f) => f.groupId === g.id);
        return (
          <div key={g.id}>
            <p className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-[#4A3B7C]">
              <span aria-hidden className="text-[#C9A6F2]">
                ♦
              </span>
              <span className="truncate">{g.name}</span>
              <button
                type="button"
                onClick={() => setGroupModal({ groupId: g.id, name: g.name })}
                aria-label={`編輯${g.name}`}
                className="ml-auto shrink-0"
              >
                <IconImg src={ICON_PATHS.edit} alt="編輯" size={14} />
              </button>
            </p>
            {groupTrips.length === 0 ? (
              <p className="mt-2 text-xs text-[#B3ABD4]">還沒有行程，點右上角新增</p>
            ) : (
              <div className="mt-2 flex flex-col gap-2.5">
                {groupTrips.map((f) => (
                  <div key={f.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)]">
                    <ImageSlot src={frequentTripIconPath(f.icon)} alt={`${f.origin}到${f.dest}`} className="size-12 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#4A3B7C]">
                        {f.origin} <span aria-hidden>⇄</span> {f.dest}
                      </p>
                      <p className="mt-0.5 text-xs text-[#9C94C4]">
                        {f.startTime}–{f.endTime}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/tools/transit/results?origin=${encodeURIComponent(f.origin)}&dest=${encodeURIComponent(f.dest)}&mode=${tab}&startTime=${encodeURIComponent(f.startTime)}&endTime=${encodeURIComponent(f.endTime)}`,
                        )
                      }
                      className="shrink-0 rounded-full bg-[#F3EFFC] px-3 py-1.5 text-xs font-medium text-[#6F5FD6]"
                    >
                      搜尋班次 →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {groupsForTab.length === 0 && <p className="mt-5 text-xs text-[#B3ABD4]">還沒有任何分類，點下方新增第一個分類</p>}

      <button
        type="button"
        onClick={() => setGroupModal({ groupId: null, name: "" })}
        className="mt-4 w-full rounded-xl border border-dashed border-[#C7BFE6] py-2.5 text-sm font-medium text-[#6F5FD6]"
      >
        ＋ 新增分類
      </button>
    </div>
  );
}
