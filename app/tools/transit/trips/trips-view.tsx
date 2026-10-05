"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FrequentTripModal, type FrequentTripDraft } from "@/components/dream/frequent-trip-modal";
import { frequentTripIconPath } from "@/components/dream/frequent-trip-icons";
import { ImageSlot } from "@/components/dream/image-slot";
import { FaIcon } from "@/components/dream/fa-icon";
import { ListRowSkeleton } from "@/components/dream/list-row-skeleton";
import { loadSkeletonCount, saveSkeletonCount } from "@/components/dream/skeleton-count";
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

// 分類、行程都是使用者自己增減的清單，每個車種各自的筆數會不一樣——骨架列數照目前
// 選中的車種分別記住上次的分類數／行程數，不要固定寫死，猜錯的話資料回來那一刻畫面
// 高度會跳一下。
const tripGroupsCountKey = (mode: Mode) => `cpx-tools:transit:trip-groups-count:${mode}`;
const tripItemsCountKey = (mode: Mode) => `cpx-tools:transit:trip-items-count:${mode}`;

function saveTripSkeletonCounts(groups: TripGroup[], trips: FrequentTrip[]) {
  for (const t of TABS) {
    saveSkeletonCount(tripGroupsCountKey(t.key), groups.filter((g) => g.mode === t.key).length);
    saveSkeletonCount(tripItemsCountKey(t.key), trips.filter((f) => f.mode === t.key).length);
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
  const [tripsReady, setTripsReady] = useState(false);
  // 初始值先給固定的 1（伺服器端渲染那一次沒有 localStorage，要跟瀏覽器端算出來的結果
  // 一致才不會 hydration 不匹配），掛載後、以及切換車種分頁時才用下面的 effect 翻成
  // 「目前這個車種上次實際筆數」的猜測值。
  const [groupSkeletonCount, setGroupSkeletonCount] = useState(1);
  const [tripSkeletonCount, setTripSkeletonCount] = useState(1);
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
    // 跟首頁套用 localStorage 存的預設值同一種例外：掛載後、或 tab 換了才讀得到當下這個
    // 車種上次記住的筆數，不是在訂閱外部事件、也不會連鎖觸發其他 effect。
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setGroupSkeletonCount(loadSkeletonCount(tripGroupsCountKey(tab), 1));
    setTripSkeletonCount(loadSkeletonCount(tripItemsCountKey(tab), 1));
  }, [tab]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/transit/trip-groups").then((res) => res.json()),
      fetch("/api/transit/frequent-trips").then((res) => res.json()),
    ])
      .then(([groupsData, tripsData]: [{ groups?: TripGroup[] }, { trips?: FrequentTrip[] }]) => {
        if (cancelled) return;
        const groups = groupsData.groups ?? [];
        const trips = tripsData.trips ?? [];
        setTripGroups(groups);
        setFrequentTrips(trips);
        setTripsReady(true);
        saveTripSkeletonCounts(groups, trips);
      })
      .catch(() => {
        if (!cancelled) setTripsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 分類名稱、底下的行程清單在同一個彈窗一次編輯：新增分類時先建立分類拿到 id，
  // 再用這個 id 把填好的行程存進去；編輯既有分類則是改名＋同步清單兩件事一起做。
  async function saveGroup(name: string, items: FrequentTripDraft[]) {
    if (!groupModal) return;
    // 畫面上現有的 tripGroups／frequentTrips state 是「這次操作開始前」的舊值，這個函式
    // 執行過程中會呼叫好幾次 setState，state 要等重新渲染才會更新，不能拿來組最後要存進
    // localStorage 的筆數；用這兩個本地變數追蹤「這次操作做完後」的最終清單才會準。
    let finalGroups = tripGroups;
    let finalTrips = frequentTrips;

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
        if (renameData.groups) {
          finalGroups = renameData.groups;
          setTripGroups(finalGroups);
        }
      }
      const tripsData: { trips?: FrequentTrip[] } = await fetch("/api/transit/frequent-trips", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: tab, groupId, items }),
      })
        .then((res) => res.json())
        .catch(() => ({}));
      if (tripsData.trips) {
        finalTrips = tripsData.trips;
        setFrequentTrips(finalTrips);
      }
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
      finalGroups = createData.groups ?? [];
      setTripGroups(finalGroups);
      if (items.length > 0) {
        const tripsData: { trips?: FrequentTrip[] } = await fetch("/api/transit/frequent-trips", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: tab, groupId: createData.group.id, items }),
        })
          .then((res) => res.json())
          .catch(() => ({}));
        if (tripsData.trips) {
          finalTrips = tripsData.trips;
          setFrequentTrips(finalTrips);
        }
      }
    }
    saveTripSkeletonCounts(finalGroups, finalTrips);
    setGroupModal(null);
  }

  async function deleteGroup(groupId: string) {
    const data: { groups?: TripGroup[]; trips?: FrequentTrip[] } = await fetch(`/api/transit/trip-groups?id=${groupId}`, {
      method: "DELETE",
    })
      .then((res) => res.json())
      .catch(() => ({}));
    const finalGroups = data.groups ?? tripGroups;
    const finalTrips = data.trips ?? frequentTrips;
    if (data.groups) setTripGroups(finalGroups);
    if (data.trips) setFrequentTrips(finalTrips);
    saveTripSkeletonCounts(finalGroups, finalTrips);
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

      {!tripsReady ? (
        // 骨架列數跟著目前車種上次記住的分類數／行程數猜，不是固定寫死——分類跟底下的
        // 行程筆數把它平均分配到每個分類骨架下面，湊不滿一個分類至少顯示一列。
        Array.from({ length: groupSkeletonCount }, (_, groupIndex) => (
          <div key={groupIndex} className="mt-5 flex flex-col gap-2.5">
            <div className="h-4 w-24 animate-pulse rounded-full bg-[#E4DBF9]" />
            {Array.from({ length: Math.max(1, Math.round(tripSkeletonCount / groupSkeletonCount)) }, (_, i) => (
              <div key={i} className="rounded-2xl bg-white p-3 shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)]">
                <ListRowSkeleton iconSize={48} />
              </div>
            ))}
          </div>
        ))
      ) : (
        <>
          {groupsForTab.map((g) => {
            const groupTrips = frequentTrips.filter((f) => f.groupId === g.id);
            return (
              <div key={g.id}>
                <p className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-[#4A3B7C]">
                  <span className="truncate">{g.name}</span>
                  <button
                    type="button"
                    onClick={() => setGroupModal({ groupId: g.id, name: g.name })}
                    aria-label={`編輯${g.name}`}
                    className="ml-auto shrink-0"
                  >
                    <FaIcon icon="pen" size={14} />
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
                              `/tools/transit/results?origin=${encodeURIComponent(f.origin)}&dest=${encodeURIComponent(f.dest)}&mode=${tab}&startTime=${encodeURIComponent(f.startTime)}&endTime=${encodeURIComponent(f.endTime)}&from=trips`,
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
        </>
      )}

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
