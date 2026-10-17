"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FrequentTripModal, type FrequentTripDraft } from "@/components/transit/frequent-trip-modal";
import { frequentTripIconPath } from "@/components/transit/frequent-trip-icons";
import { ImageSlot } from "@/components/transit/image-slot";
import { routeBadgeStyle } from "@/components/transit/bus-route-picker-modal";
import { NearbyButton } from "@/components/transit/nearby-button";
import { ListRowSkeleton, SkeletonBar } from "@/components/transit/skeleton";
import { loadSkeletonShape, saveSkeletonCount, saveSkeletonShape } from "@/components/transit/skeleton-count";
import { CenterToast } from "@/components/transit/center-toast";
import {
  AddButton,
  Badge,
  DragHandle,
  ErrorText,
  Hint,
  IconButton,
  ListCard,
  PageTitle,
  PillButton,
  SectionTitle,
  SegmentedTabs,
} from "@/components/transit/ui";
import { copy, shadow, text } from "@/components/transit/theme";
import { moveItem, useDragReorder } from "@/components/transit/use-drag-reorder";

type Mode = "bus" | "train" | "metro" | "thsr";

// 分類名稱（例如「上班」「下班」「假日出去玩」）完全由使用者自訂、自由新增，不是寫死的
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

// 記住使用者最後一次停留的分頁（跟首頁 home-view.tsx 的 LAST_MODE_KEY 同一個做法），
// 不是套用固定的預設值——這樣重新整理才會停在離開前的那個車種，不會每次都跳回某個
// 設定值。
const LAST_TAB_KEY = "cpx-tools:transit:trips-last-tab";

function loadLastTab(): Mode | null {
  try {
    const raw = localStorage.getItem(LAST_TAB_KEY);
    return TABS.some((t) => t.key === raw) ? (raw as Mode) : null;
  } catch {
    return null;
  }
}

function saveLastTab(tab: Mode) {
  try {
    localStorage.setItem(LAST_TAB_KEY, tab);
  } catch {
    // 私密瀏覽模式等情況下 localStorage 可能不可用，失敗就當作這次沒存，不影響當下操作。
  }
}

// 分類、行程都是使用者自己增減的清單，每個車種的筆數都不一樣——骨架要畫得跟載入完一模
// 一樣，所以記的不是「總共幾個分類、總共幾筆行程」（那樣只能平均分配，分類筆數不平均時
// 一定對不上），而是「每個分類各自有幾筆行程」這個形狀陣列，例如 [3, 1, 2]。
const tripShapeKey = (mode: Mode) => `cpx-tools:transit:trip-shape:${mode}`;
// 分類數量另外也存一份單純的數字：搜尋結果頁的「加入行程」彈窗要用同一個數字畫骨架
// （見 components/transit/trip-group-picker-modal.tsx），那邊不需要知道每個分類底下幾筆。
const tripGroupsCountKey = (mode: Mode) => `cpx-tools:transit:trip-groups-count:${mode}`;

function saveTripSkeletonShape(groups: TripGroup[], trips: FrequentTrip[]) {
  for (const t of TABS) {
    const modeGroups = groups.filter((g) => g.mode === t.key);
    saveSkeletonShape(
      tripShapeKey(t.key),
      modeGroups.map((g) => trips.filter((f) => f.groupId === g.id).length),
    );
    saveSkeletonCount(tripGroupsCountKey(t.key), modeGroups.length);
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
  // 骨架形狀的初始值只能先給 null（伺服器端渲染那一次沒有 localStorage，要跟瀏覽器端算
  // 出來的結果一致才不會 hydration 不匹配），掛載後、以及切換車種分頁時才用下面的 effect
  // 翻成「目前這個車種上次實際形狀」。完全沒存過（新帳號、這個車種從來沒設定過分類）是
  // null——不要猜「至少有 1 個分類」，不然新帳號會先閃一塊看起來像有資料的骨架，之後才
  // 變成「還沒有任何分類」的空狀態，畫面跳動又誤導。
  const [skeletonShape, setSkeletonShape] = useState<number[] | null>(null);
  // null＝彈窗關閉；groupId 為 null 代表正在新增一個全新分類，否則是在編輯該 id 的既有分類。
  const [groupModal, setGroupModal] = useState<{ groupId: string | null; name: string } | null>(null);
  // 新增／儲存分類成功後的提示文字，跟結果頁「加入行程」同一個 CenterToast 元件。
  const [toast, setToast] = useState<string | null>(null);
  const groupsForTab = tripGroups.filter((g) => g.mode === tab);

  // 標題旁「附近站點」：使用者只是想知道現在的位置離火車站、捷運站、高鐵站哪一個比較近，
  // 不需要查班次，所以不自己刻一套距離計算＋清單（那套要先幫火車/高鐵/捷運三種車種都
  // 補上真實座標，工程量不小）——直接定位完丟去 Google Maps，讓使用者在原生地圖上自己
  // 看附近有哪些站、距離多少，跟 Ubike「立即導航」同一個「不自己畫地圖」的理由。
  // 這是一次性動作（開新分頁），不是可以切換開關的「附近模式」，所以不用 NearbyButton
  // 的 active/取消 狀態，active 固定傳 false。
  const [locatingNearbyStation, setLocatingNearbyStation] = useState(false);
  const [nearbyStationError, setNearbyStationError] = useState<string | null>(null);

  function openNearbyStationsMap() {
    if (!navigator.geolocation) {
      setNearbyStationError("這個瀏覽器不支援定位功能");
      return;
    }
    setLocatingNearbyStation(true);
    setNearbyStationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocatingNearbyStation(false);
        const { latitude, longitude } = pos.coords;
        // 16z 這個縮放層級剛好會顯示附近的車站圖示（太近看不到幾個站、太遠圖示會擠在
        // 一起分不清楚），不帶搜尋關鍵字——故意不篩「只看火車站」或「只看捷運站」，
        // 使用者原本就是想同時比較兩種車種哪個比較近，篩掉其中一種反而少了可以比較的資訊。
        window.open(`https://www.google.com/maps/@${latitude},${longitude},16z`, "_blank", "noopener,noreferrer");
      },
      (err) => {
        setLocatingNearbyStation(false);
        setNearbyStationError(err.code === err.PERMISSION_DENIED ? "請到瀏覽器設定開啟定位權限" : "定位失敗，請稍後再試");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function selectTab(key: Mode) {
    setTab(key);
    saveLastTab(key);
  }

  // 進頁面時還原使用者最後一次停留的分頁；只在掛載時套用一次，之後使用者自己切換 tab
  // 會透過 selectTab 更新記住的值，不會被這個 effect 蓋回去。
  useEffect(() => {
    const saved = loadLastTab();
    if (saved) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setTab(saved);
    }
  }, []);

  useEffect(() => {
    // 跟首頁套用 localStorage 存的預設值同一種例外：掛載後、或 tab 換了才讀得到當下這個
    // 車種上次記住的形狀，不是在訂閱外部事件、也不會連鎖觸發其他 effect。
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setSkeletonShape(loadSkeletonShape(tripShapeKey(tab)));
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
        saveTripSkeletonShape(groups, trips);
      })
      .catch(() => {
        if (!cancelled) setTripsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 分類的顯示順序＝資料庫 order 欄位（見 lib/transit/trip-groups.ts）。以前 order 只有
  // 新增當下寫一次，所以永遠是建立順序，想把「上班」固定在最上面只能砍掉重建；現在用
  // 拖曳握把改順序，放手時把整個車種的 id 順序送回後端。
  //
  // 畫面上先樂觀更新（拖曳過程中就已經是新順序了），API 回來再用後端算出來的結果覆蓋，
  // 失敗就維持畫面上的順序——下次重新整理會回到後端的真實順序，不會卡在一個假的狀態。
  function moveGroup(from: number, to: number) {
    setTripGroups((all) => {
      const forTab = all.filter((g) => g.mode === tab);
      const reordered = moveItem(forTab, from, to);
      // 其他車種的分類原封不動留在原位，只有目前這個車種的那幾筆重新排。
      const others = all.filter((g) => g.mode !== tab);
      return [...reordered, ...others];
    });
  }

  async function commitGroupOrder() {
    const orderedIds = tripGroups.filter((g) => g.mode === tab).map((g) => g.id);
    const data: { groups?: TripGroup[] } = await fetch("/api/transit/trip-groups", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: tab, orderedIds }),
    })
      .then((res) => res.json())
      .catch(() => ({}));
    if (data.groups) {
      setTripGroups(data.groups);
      saveTripSkeletonShape(data.groups, frequentTrips);
    }
  }

  const drag = useDragReorder(groupsForTab.length, moveGroup, commitGroupOrder);

  // 分類名稱、底下的行程清單在同一個彈窗一次編輯：新增分類時先建立分類拿到 id，
  // 再用這個 id 把填好的行程存進去；編輯既有分類則是改名＋同步清單兩件事一起做。
  async function saveGroup(name: string, items: FrequentTripDraft[]) {
    if (!groupModal) return;
    // groupModal.groupId 是 null 代表這次是新增一個全新分類，不是在編輯既有分類——兩種
    // 情況成功後要顯示的提示文字不一樣（新增成功／儲存成功），要在下面清掉 groupModal
    // 之前先記住，不然等做完這個判斷式就沒意義了。
    const isNewGroup = !groupModal.groupId;
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
    saveTripSkeletonShape(finalGroups, finalTrips);
    setGroupModal(null);
    setToast(isNewGroup ? copy.created : copy.saved);
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
    saveTripSkeletonShape(finalGroups, finalTrips);
    setGroupModal(null);
    if (data.groups) setToast(copy.deleted);
  }

  return (
    <div className="flex flex-col px-5 pb-6 pt-6">
      <PageTitle
        actions={<NearbyButton active={false} locating={locatingNearbyStation} label="附近站點" onClick={openNearbyStationsMap} />}
      >
        我的{copy.tripItem}
      </PageTitle>
      {nearbyStationError && <ErrorText className="mt-2">{nearbyStationError}</ErrorText>}

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

      <div className="mt-4 self-start">
        <SegmentedTabs items={TABS} value={tab} onChange={selectTab} />
      </div>

      {!tripsReady ? (
        skeletonShape === null ? (
          // 沒有上次記住的形狀可以猜（新帳號、或這個車種從來沒存過分類）時，骨架會是空的，
          // 畫面上什麼都不顯示——在真正查完之前會有一段空白，容易讓人誤會頁面卡住，所以
          // 這裡額外補一個「載入中」文字。
          <Hint className="mt-5">{copy.loading}</Hint>
        ) : (
          // 骨架的分類數、每個分類底下的行程列數都跟上次實際的一模一樣（不是用總數平均
          // 分配），資料回來那一刻版面高度不會跳。
          skeletonShape.map((rows, groupIndex) => (
            <div key={groupIndex} className="mt-5 flex flex-col gap-2.5">
              <SkeletonBar width={96} height={16} />
              {rows === 0 ? (
                <SkeletonBar width="40%" height={12} />
              ) : (
                Array.from({ length: rows }, (_, i) => (
                  <div key={i} className="rounded-2xl bg-white p-3" style={{ boxShadow: shadow.card }}>
                    <ListRowSkeleton iconSize={48} />
                  </div>
                ))
              )}
            </div>
          ))
        )
      ) : (
        <>
          {groupsForTab.map((g, groupIndex) => {
            const groupTrips = frequentTrips.filter((f) => f.groupId === g.id);
            return (
              <div key={g.id} ref={drag.rowRef(groupIndex)} className={drag.rowClass(groupIndex)}>
                <SectionTitle
                  className="mt-5"
                  action={
                    <IconButton icon="pen" size={28} onClick={() => setGroupModal({ groupId: g.id, name: g.name })} aria-label={`編輯${g.name}`} />
                  }
                >
                  {/* 只有兩個以上的分類才需要排序，單一分類時不顯示握把（拖也沒意義）。 */}
                  {groupsForTab.length > 1 && <DragHandle label={`拖曳排序 ${g.name}`} {...drag.handleProps(groupIndex)} />}
                  <span className="truncate">{g.name}</span>
                </SectionTitle>
                {groupTrips.length === 0 ? (
                  <Hint className="mt-2">還沒有{copy.tripItem}，點{copy.group}右邊的編輯新增</Hint>
                ) : (
                  <div className="mt-2 flex flex-col gap-2.5">
                    {groupTrips.map((f) => (
                      <ListCard key={f.id} className="flex items-center gap-3">
                        <ImageSlot src={frequentTripIconPath(f.icon)} alt={`${f.origin}到${f.dest}`} className="size-12 shrink-0 rounded-xl" />
                        <div className="min-w-0 flex-1">
                          {tab === "bus" ? (
                            <>
                              <Badge className={routeBadgeStyle(f.origin)}>{f.origin}</Badge>
                              <p className={`mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 truncate ${text.cardTitle}`}>
                                <span className={text.meta}>{f.busDirection === 1 ? "返程" : "去程"}</span>
                                <span aria-hidden>·</span>
                                {f.dest}
                              </p>
                            </>
                          ) : (
                            // 捷運存的 f.origin/f.dest 保留原始的「路線代碼＋站碼＋站名」
                            // 字串——理由跟結果頁標題一致，同一個「台北車站」有 BL12／
                            // R10／A1 三種代碼，卡片上留著代碼才看得出來存的是哪一個。
                            <p className={`truncate ${text.cardTitle}`}>
                              {f.origin} <span aria-hidden>⇄</span> {f.dest}
                            </p>
                          )}
                          <p className={`mt-0.5 ${text.meta}`}>
                            {f.startTime}–{f.endTime}
                          </p>
                        </div>
                        <PillButton
                          onClick={() =>
                            router.push(
                              tab === "bus"
                                ? `/tools/transit/results?mode=bus&busCity=${encodeURIComponent(f.originCity)}&busRoute=${encodeURIComponent(f.origin)}&busDirection=${f.busDirection ?? 0}&busStop=${encodeURIComponent(f.dest)}&from=trips`
                                : `/tools/transit/results?origin=${encodeURIComponent(f.origin)}&dest=${encodeURIComponent(f.dest)}&mode=${tab}&startTime=${encodeURIComponent(f.startTime)}&endTime=${encodeURIComponent(f.endTime)}&from=trips`,
                            )
                          }
                        >
                          搜尋班次 →
                        </PillButton>
                      </ListCard>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {groupsForTab.length === 0 && (
            <Hint className="mt-5">
              還沒有任何{copy.group}，點下方新增第一個{copy.group}
            </Hint>
          )}
        </>
      )}

      <AddButton className="mt-4" onClick={() => setGroupModal({ groupId: null, name: "" })}>
        新增{copy.group}
      </AddButton>

      {toast && <CenterToast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
