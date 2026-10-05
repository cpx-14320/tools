import { tdxGet } from "@/lib/tdx-client";

// 捷運路線站序、票價幾乎不會變，快取 24 小時，跟台鐵站名清單同一套做法，不要每次搜尋
// 都去打一次 TDX（每分鐘只有 5 次額度）。
const DAY_MS = 24 * 60 * 60 * 1000;

interface TravelTimeSegment {
  Sequence: number;
  FromStationID: string;
  FromStationName: { Zh_tw: string };
  ToStationID: string;
  ToStationName: { Zh_tw: string };
  RunTime: number; // 秒
  StopTime: number; // 秒（停靠時間）
}

interface TravelTimeEntry {
  LineNo: string;
  RouteID: string;
  TravelTimes: TravelTimeSegment[];
}

interface OdFareEntry {
  Fares: { TicketType: number; FareClass: number; Price: number }[];
  TravelDistance: number;
}

// 同一條線常常不只一個 entry（去＋返程、或區段車），每個 entry 只列出「這一班實際停靠」的
// 站，不保證包含整條線全部站——所以找路徑要把每個 entry 都試過一次，不能只看第一個。
async function getTravelTimeEntries(systemCode: string): Promise<TravelTimeEntry[]> {
  return tdxGet<TravelTimeEntry[]>(`/v2/Rail/Metro/S2STravelTime/${systemCode}`, DAY_MS);
}

// TicketType 1＝單程票、FareClass 1＝普通票（全票）。
function fullFareOf(entry: OdFareEntry): number | undefined {
  return entry.Fares.find((f) => f.TicketType === 1 && f.FareClass === 1)?.Price;
}

async function getOdFare(systemCode: string, originId: string, destId: string): Promise<OdFareEntry | undefined> {
  const filter = encodeURIComponent(`OriginStationID eq '${originId}' and DestinationStationID eq '${destId}'`);
  const data = await tdxGet<OdFareEntry[]>(`/v2/Rail/Metro/ODFare/${systemCode}?$filter=${filter}`, DAY_MS);
  return data[0];
}

/** 站點顯示字串（例如「BL07板橋」）開頭那段路線代碼＋站碼，用來對應 TDX 的 StationID。 */
export function stationIdOf(display: string): string {
  return display.match(/^[A-Za-z]+\d+[A-Za-z]?/)?.[0] ?? display;
}

// 轉乘站秒數：捷運站內轉乘（走到對面月台或換層）實際大約 2～4 分鐘，這裡用中間值估算，
// 不是 TDX 查回來的真實資料。
const TRANSFER_PENALTY_SECONDS = 180;

interface GraphEdge {
  to: string;
  seconds: number;
  /** true＝同名不同代碼之間的轉乘邊，不是真的坐車前進一站，算站數時不能計入。 */
  transfer: boolean;
}

// 把全系統的站間行車時間資料變成一個圖：節線站碼當節點，S2STravelTime 的每一段是一條邊
// （雙向，實務上轉乘到對向月台也能反著搭）；另外同名但不同線代碼的站（例如西門是 BL11
// 也是 G12）之間再加一條「轉乘邊」。這樣不管要轉幾次車，從出發站到抵達站的最短路徑都能
// 用同一套最短路徑演算法算出來，不用為「一次轉乘」「兩次轉乘」各寫一套特例判斷。
function buildGraph(entries: TravelTimeEntry[]): { graph: Map<string, GraphEdge[]>; nameOf: Map<string, string> } {
  const graph = new Map<string, GraphEdge[]>();
  const nameOf = new Map<string, string>();
  const addEdge = (a: string, b: string, seconds: number, transfer: boolean) => {
    if (!graph.has(a)) graph.set(a, []);
    graph.get(a)!.push({ to: b, seconds, transfer });
  };

  for (const entry of entries) {
    for (const seg of entry.TravelTimes) {
      nameOf.set(seg.FromStationID, seg.FromStationName.Zh_tw);
      nameOf.set(seg.ToStationID, seg.ToStationName.Zh_tw);
      const seconds = seg.RunTime + seg.StopTime;
      addEdge(seg.FromStationID, seg.ToStationID, seconds, false);
      addEdge(seg.ToStationID, seg.FromStationID, seconds, false);
    }
  }

  const idsByName = new Map<string, Set<string>>();
  for (const [id, name] of nameOf) {
    if (!idsByName.has(name)) idsByName.set(name, new Set());
    idsByName.get(name)!.add(id);
  }
  for (const ids of idsByName.values()) {
    const list = [...ids];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        addEdge(list[i], list[j], TRANSFER_PENALTY_SECONDS, true);
        addEdge(list[j], list[i], TRANSFER_PENALTY_SECONDS, true);
      }
    }
  }

  return { graph, nameOf };
}

export interface GraphRoute {
  seconds: number;
  stops: number;
  transferStationNames: string[];
}

// 最短路徑（Dijkstra）：圖的節點數最多幾百個，用最簡單的「每次線性掃描找最小值」就夠快，
// 不需要另外實作優先佇列。
function shortestPath(graph: Map<string, GraphEdge[]>, nameOf: Map<string, string>, originId: string, destId: string): GraphRoute | null {
  if (!graph.has(originId)) return null;
  const dist = new Map<string, number>([[originId, 0]]);
  const stops = new Map<string, number>([[originId, 0]]);
  const transfers = new Map<string, string[]>([[originId, []]]);
  const visited = new Set<string>();

  while (true) {
    let currentId: string | null = null;
    let currentDist = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < currentDist) {
        currentDist = d;
        currentId = id;
      }
    }
    if (currentId === null || currentId === destId) break;
    visited.add(currentId);

    for (const edge of graph.get(currentId) ?? []) {
      if (visited.has(edge.to)) continue;
      const candidate = currentDist + edge.seconds;
      if (candidate < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, candidate);
        stops.set(edge.to, (stops.get(currentId) ?? 0) + (edge.transfer ? 0 : 1));
        const priorTransfers = transfers.get(currentId) ?? [];
        transfers.set(edge.to, edge.transfer ? [...priorTransfers, nameOf.get(currentId) ?? ""] : priorTransfers);
      }
    }
  }

  if (!dist.has(destId)) return null;
  return { seconds: dist.get(destId)!, stops: (stops.get(destId) ?? 0) + 1, transferStationNames: transfers.get(destId) ?? [] };
}

export interface MetroTripResult {
  durationMin: number;
  stops: number;
  /** undefined 代表查不到真實票價，前端要退回顯示「—」，不要憑空編一個數字。 */
  fare?: number;
  transfer: boolean;
  /** 需要轉乘時的轉乘站名，可能轉好幾次車就有好幾個，用「、」接起來顯示。 */
  transferStationName?: string;
}

const AVERAGE_SPEED_KM_PER_MIN = 35 / 60; // 捷運含停站平均營運速度，查不到真實行車時間時的保險估算

/** 同一個捷運系統內（不跨系統）查真實的站間行車時間、票價、是否要轉乘（可能轉好幾次）。 */
export async function computeMetroTrip(systemCode: string, originDisplay: string, destDisplay: string): Promise<MetroTripResult> {
  const originId = stationIdOf(originDisplay);
  const destId = stationIdOf(destDisplay);

  const [entries, fareEntry] = await Promise.all([
    getTravelTimeEntries(systemCode),
    getOdFare(systemCode, originId, destId).catch(() => undefined),
  ]);

  const { graph, nameOf } = buildGraph(entries);
  const route = shortestPath(graph, nameOf, originId, destId);
  const fare = fareEntry ? fullFareOf(fareEntry) : undefined;

  if (route) {
    return {
      durationMin: Math.max(1, Math.round(route.seconds / 60)),
      stops: route.stops,
      fare,
      transfer: route.transferStationNames.length > 0,
      transferStationName: route.transferStationNames.length > 0 ? route.transferStationNames.join("、") : undefined,
    };
  }

  // 真的連不出路徑時的保險（理論上同系統應該都連得到，資料異常時才會走到這裡）：
  // 用 ODFare 附帶的距離粗估時間，不猜站數、不猜是否要轉乘。
  const distance = fareEntry?.TravelDistance;
  return {
    durationMin: distance ? Math.max(1, Math.round(distance / AVERAGE_SPEED_KM_PER_MIN)) : 20,
    stops: 1,
    fare,
    transfer: false,
  };
}
