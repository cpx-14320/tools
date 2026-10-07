import { tdxGet } from "@/lib/tdx-client";
import { METRO_CROSS_CITY_GROUP, METRO_SYSTEM_CODE, METRO_TRANSFER_HUBS } from "@/lib/metro-lines";

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

interface LineEntry {
  LineNo: string;
  /** 官方訂的路線顏色（例如板南線 "#0a59ae"），轉乘提示的線別代碼標籤直接用這個顏色，
   *  不用自己另外配色——跟捷運圖上看到的顏色一致，使用者才認得出來是哪條線。 */
  LineColor: string;
}

// 同一條線常常不只一個 entry（去＋返程、或區段車），每個 entry 只列出「這一班實際停靠」的
// 站，不保證包含整條線全部站——所以找路徑要把每個 entry 都試過一次，不能只看第一個。
async function getTravelTimeEntries(systemCode: string): Promise<TravelTimeEntry[]> {
  return tdxGet<TravelTimeEntry[]>(`/v2/Rail/Metro/S2STravelTime/${systemCode}`, DAY_MS);
}

// S2STravelTime 的站碼開頭字母就是這個站所屬的線別代碼（例如 BL14、O07），跟這支 /Line
// 端點回傳的 LineNo 是同一套代碼，用來查「轉乘到哪個代碼」對應的官方路線顏色。
async function getLines(systemCode: string): Promise<LineEntry[]> {
  return tdxGet<LineEntry[]>(`/v2/Rail/Metro/Line/${systemCode}`, DAY_MS);
}

function lineNoOfStationId(id: string): string {
  return id.match(/^[A-Za-z]+/)?.[0] ?? id;
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
  /** true＝明確定義的轉乘邊，不是真的坐車前進一站，算站數時不能計入。 */
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

  // 1. TDX 提供的實際站間行車邊。
  for (const entry of entries) {
    for (const seg of entry.TravelTimes) {
      nameOf.set(seg.FromStationID, seg.FromStationName.Zh_tw);
      nameOf.set(seg.ToStationID, seg.ToStationName.Zh_tw);

      const seconds = seg.RunTime + seg.StopTime;
      addEdge(seg.FromStationID, seg.ToStationID, seconds, false);
      addEdge(seg.ToStationID, seg.FromStationID, seconds, false);
    }
  }

  // 2. 轉乘邊只從 METRO_TRANSFER_HUBS 建立。
  //    不再用「站名相同」自動推導，避免未經確認的同名站被誤判為轉乘點。
  const stationIdsInGraph = new Set(nameOf.keys());

  for (const hub of METRO_TRANSFER_HUBS) {
    const stationIds = hub.stations
      .map((station) => stationIdOf(station))
      .filter((id) => stationIdsInGraph.has(id));

    for (let i = 0; i < stationIds.length; i++) {
      for (let j = i + 1; j < stationIds.length; j++) {
        const a = stationIds[i];
        const b = stationIds[j];

        addEdge(a, b, TRANSFER_PENALTY_SECONDS, true);
        addEdge(b, a, TRANSFER_PENALTY_SECONDS, true);
      }
    }
  }

  return { graph, nameOf };
}

/** 將多個捷運系統的單系統圖合併成一張路網圖。 */
function mergeGraphs(
  systemGraphs: Array<{ graph: Map<string, GraphEdge[]>; nameOf: Map<string, string> }>,
): { graph: Map<string, GraphEdge[]>; nameOf: Map<string, string> } {
  const graph = new Map<string, GraphEdge[]>();
  const nameOf = new Map<string, string>();

  for (const systemGraph of systemGraphs) {
    for (const [id, edges] of systemGraph.graph) {
      if (!graph.has(id)) graph.set(id, []);
      graph.get(id)!.push(...edges);
    }
    for (const [id, name] of systemGraph.nameOf) {
      nameOf.set(id, name);
    }
  }

  return { graph, nameOf };
}

/**
 * 在合併後的多系統路網中加入跨系統轉乘邊。
 * 轉乘關係完全依照 METRO_TRANSFER_HUBS，不使用站名猜測。
 */
function addCrossSystemTransferEdges(
  graph: Map<string, GraphEdge[]>,
  nameOf: Map<string, string>,
): void {
  const addEdge = (a: string, b: string, seconds: number, transfer: boolean) => {
    if (!graph.has(a)) graph.set(a, []);
    graph.get(a)!.push({ to: b, seconds, transfer });
  };

  const stationIdsInGraph = new Set(nameOf.keys());

  for (const hub of METRO_TRANSFER_HUBS) {
    const stationIds = hub.stations
      .map((station) => stationIdOf(station))
      .filter((id) => stationIdsInGraph.has(id));

    for (let i = 0; i < stationIds.length; i++) {
      for (let j = i + 1; j < stationIds.length; j++) {
        const a = stationIds[i];
        const b = stationIds[j];
        addEdge(a, b, TRANSFER_PENALTY_SECONDS, true);
        addEdge(b, a, TRANSFER_PENALTY_SECONDS, true);
      }
    }
  }
}

export interface TransferStep {
  /** 要在哪一站轉乘。 */
  stationName: string;
  /** 轉乘之後改搭哪條線的代碼（例如 "R"、"O"），畫面上用這個代碼配官方顏色做成小標籤，
   *  不顯示完整線名——轉乘句子本來就不短，用代碼比較不會太長。查不到才會是 undefined，
   *  這種情況畫面上只顯示站名、不顯示線別標籤。 */
  lineNo?: string;
  /** lineNo 對應的官方路線顏色（例如 "#0a59ae"），查不到也會是 undefined。 */
  lineColor?: string;
}

export interface GraphRoute {
  seconds: number;
  stops: number;
  transferSteps: TransferStep[];
}

// 最短路徑（Dijkstra）：圖的節點數最多幾百個，用最簡單的「每次線性掃描找最小值」就夠快，
// 不需要另外實作優先佇列。
function shortestPath(
  graph: Map<string, GraphEdge[]>,
  nameOf: Map<string, string>,
  lineColorOf: Map<string, string>,
  originId: string,
  destId: string,
): GraphRoute | null {
  if (!graph.has(originId)) return null;
  const dist = new Map<string, number>([[originId, 0]]);
  const stops = new Map<string, number>([[originId, 0]]);
  const transfers = new Map<string, TransferStep[]>([[originId, []]]);
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
        // 轉乘邊走到的那一站（edge.to）就是換上新線之後的第一站，站碼開頭字母對應的
        // 線別就是「轉乘之後要搭的線」，不是轉乘之前那條線。
        transfers.set(
          edge.to,
          edge.transfer
            ? [
                ...priorTransfers,
                {
                  stationName: nameOf.get(currentId) ?? "",
                  lineNo: lineNoOfStationId(edge.to),
                  lineColor: lineColorOf.get(lineNoOfStationId(edge.to)),
                },
              ]
            : priorTransfers,
        );
      }
    }
  }

  if (!dist.has(destId)) return null;
  return { seconds: dist.get(destId)!, stops: (stops.get(destId) ?? 0) + 1, transferSteps: transfers.get(destId) ?? [] };
}

export interface MetroTripResult {
  durationMin: number;
  stops: number;
  /** undefined 代表查不到真實票價，前端要退回顯示「—」，不要憑空編一個數字。 */
  fare?: number;
  transfer: boolean;
  /** 需要轉乘時每一段轉乘的明細（在哪一站、換成哪條線），可能轉好幾次車就有好幾筆；
   *  畫面上怎麼組字串、要不要加線別顏色標籤交給前端決定，這裡只給結構化資料。 */
  transferSteps?: TransferStep[];
}

const AVERAGE_SPEED_KM_PER_MIN = 35 / 60; // 捷運含停站平均營運速度，查不到真實行車時間時的保險估算

/** 同一個捷運系統內（不跨系統）查真實的站間行車時間、票價、是否要轉乘（可能轉好幾次）。 */
export async function computeMetroTrip(systemCode: string, originDisplay: string, destDisplay: string): Promise<MetroTripResult> {
  const originId = stationIdOf(originDisplay);
  const destId = stationIdOf(destDisplay);

  const [entries, fareEntry, lines] = await Promise.all([
    getTravelTimeEntries(systemCode),
    getOdFare(systemCode, originId, destId).catch(() => undefined),
    getLines(systemCode).catch(() => []),
  ]);

  const lineColorOf = new Map<string, string>(lines.map((l) => [l.LineNo, l.LineColor] as const));
  const originLineNo = lineNoOfStationId(originId);
  const originLineColor = lineColorOf.get(originLineNo);
  const { graph, nameOf } = buildGraph(entries);
  const route = shortestPath(graph, nameOf, lineColorOf, originId, destId);
  const fare = fareEntry ? fullFareOf(fareEntry) : undefined;

  if (route) {
    return {
      durationMin: Math.max(1, Math.round(route.seconds / 60)),
      stops: route.stops,
      fare,
      transfer: route.transferSteps.length > 0,
      transferSteps: route.transferSteps.length > 0 ? route.transferSteps : undefined,
      lineColor: originLineColor,
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
    lineColor: originLineColor,
  };
}


/**
 * 北北基桃可互通捷運／輕軌的跨系統路由。
 *
 * 只抓「目前可互通群組」的 S2STravelTime 與 Line metadata；
 * TDX cache 會避免同一日重複呼叫，Line metadata 同時用於主要搭乘線與轉乘提示的顏色。
 * 票價也不自行把不同營運系統的票價相加，因此 fare 保持 undefined。
 */
export async function computeCrossSystemMetroTrip(
  originSystem: string,
  destSystem: string,
  originDisplay: string,
  destDisplay: string,
): Promise<MetroTripResult> {
  if (originSystem === destSystem) {
    const systemCode = METRO_SYSTEM_CODE[originSystem];
    if (!systemCode) throw new Error("不支援的捷運系統");
    return computeMetroTrip(systemCode, originDisplay, destDisplay);
  }

  const allowedSystems = new Set(METRO_CROSS_CITY_GROUP);
  if (!allowedSystems.has(originSystem) || !allowedSystems.has(destSystem)) {
    throw new Error("這兩個捷運系統目前不在可跨系統查詢範圍");
  }

  const systemNames = [...METRO_CROSS_CITY_GROUP];
  const systemData = await Promise.all(
    systemNames.map(async (system) => {
      const systemCode = METRO_SYSTEM_CODE[system];
      const [entries, lines] = await Promise.all([
        getTravelTimeEntries(systemCode),
        getLines(systemCode).catch(() => []),
      ]);
      return { system, systemCode, entries, lines };
    }),
  );

  const systemGraphs = systemData
    .filter((item) => Boolean(item.systemCode))
    .map((item) => buildGraph(item.entries));

  const { graph, nameOf } = mergeGraphs(systemGraphs);
  addCrossSystemTransferEdges(graph, nameOf);

  // 北北基桃可互通群組中的 LineNo 不重複（台北 G/R/O/BL/BR、新北 Y/LB、機捷 A），
  // 因此可合併成同一張顏色表，讓跨系統轉乘標籤與主要搭乘線都沿用 TDX 官方顏色。
  const lineColorOf = new Map<string, string>(
    systemData.flatMap((item) => item.lines.map((line) => [line.LineNo, line.LineColor] as const)),
  );
  const originId = stationIdOf(originDisplay);
  const destId = stationIdOf(destDisplay);
  const originLineNo = lineNoOfStationId(originId);
  const originLineColor = lineColorOf.get(originLineNo);
  const route = shortestPath(graph, nameOf, lineColorOf, originId, destId);

  if (!route) {
    throw new Error("找不到跨系統捷運路徑，請確認站點與轉乘關係");
  }

  return {
    durationMin: Math.max(1, Math.round(route.seconds / 60)),
    stops: route.stops,
    // 不同營運系統的跨系統票價不能用單一系統 ODFare 直接推導，因此不猜。
    fare: undefined,
    transfer: true,
    transferSteps: route.transferSteps.length > 0 ? route.transferSteps : undefined,
    lineColor: originLineColor,
  };
}