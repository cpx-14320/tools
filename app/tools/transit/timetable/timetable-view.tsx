"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardBody, Badge, Button, ButtonLink } from "@/components/ui";
import { modeMeta, timetableFor, timetableOptions, type Mode, type TimetableRow } from "@/lib/transit-mock-data";
import { nowHHmmInTaipei } from "@/lib/tdx-time";
import { scrollWithin } from "@/lib/scroll-within";

const MODES = Array.from(new Set(timetableOptions.map((o) => o.mode)));

// 台鐵／高鐵／公車走真的 TDX API（見 app/api/transit/**），捷運目前還沒確認即時到離站的站點覆蓋範圍，先留在示範資料。
const LIVE_MODES: Mode[] = ["TRA", "THSR", "Bus"];

// 台鐵／高鐵需要起訖站兩個條件才能查（TDX 是 OD 查詢）；公車只需要站牌。
const OD_MODES: Mode[] = ["TRA", "THSR"];
const DEST_OPTIONS: Record<Mode, string[]> = {
  TRA: ["中壢", "南港"],
  THSR: ["台北", "台中", "新竹", "左營", "板橋"],
  Bus: [],
  Metro: [],
};

type TraFareLabel = "自強" | "莒光" | "區間";
type TraCity = { city: string; stations: { id: string; name: string }[] };

async function fetchLiveRows(
  mode: Mode,
  origin: string,
  dest: string,
  time: string,
): Promise<{ rows: TimetableRow[]; error?: string }> {
  const url =
    mode === "TRA"
      ? `/api/transit/tra/od-timetable?origin=${encodeURIComponent(origin)}&dest=${encodeURIComponent(dest)}&time=${encodeURIComponent(time)}`
      : mode === "THSR"
        ? `/api/transit/thsr/timetable?origin=${encodeURIComponent(origin)}&dest=${encodeURIComponent(dest)}&time=${encodeURIComponent(time)}`
        : `/api/transit/bus/eta?stop=${encodeURIComponent(origin)}`;

  const res = await fetch(url);
  const data = (await res.json()) as { rows: TimetableRow[]; error?: string };
  return data;
}

export function TimetableView() {
  const [mode, setMode] = useState<Mode>(MODES[0]);
  const originsForMode = useMemo(() => timetableOptions.filter((o) => o.mode === mode).map((o) => o.originName), [mode]);
  const [origin, setOrigin] = useState(originsForMode[0]);
  const [dest, setDest] = useState(DEST_OPTIONS[MODES[0]].filter((d) => d !== originsForMode[0])[0] ?? "");
  const [timeFilter, setTimeFilter] = useState(nowHHmmInTaipei());

  const [rows, setRows] = useState<TimetableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const [fares, setFares] = useState<Partial<Record<TraFareLabel, number>>>({});

  // 台鐵全站清單（依縣市分組），給「選縣市→選站」兩層選單用；全台固定清單，進頁面抓一次就夠。
  const [traCities, setTraCities] = useState<TraCity[]>([]);
  useEffect(() => {
    fetch("/api/transit/tra/stations")
      .then((res) => res.json())
      .then((data: { cities?: TraCity[] }) => setTraCities(data.cities ?? []))
      .catch(() => {});
  }, []);
  const originCity = useMemo(
    () => traCities.find((c) => c.stations.some((s) => s.name === origin))?.city ?? "",
    [traCities, origin],
  );
  const destCity = useMemo(
    () => traCities.find((c) => c.stations.some((s) => s.name === dest))?.city ?? "",
    [traCities, dest],
  );

  function changeMode(next: Mode) {
    setMode(next);
    const nextOrigin = timetableOptions.find((o) => o.mode === next)?.originName ?? "";
    setOrigin(nextOrigin);
    setDest(DEST_OPTIONS[next].filter((d) => d !== nextOrigin)[0] ?? "");
  }

  function changeOrigin(nextOrigin: string) {
    setOrigin(nextOrigin);
    const validDests = DEST_OPTIONS[mode].filter((d) => d !== nextOrigin);
    if (!validDests.includes(dest)) setDest(validDests[0] ?? "");
  }

  useEffect(() => {
    if (!LIVE_MODES.includes(mode)) return;
    if (OD_MODES.includes(mode) && origin === dest) return; // 起訖站一樣就不查，等使用者選不同的站

    let cancelled = false;
    // 查詢條件（mode/origin/dest）一變就要立刻顯示查詢中、蓋掉上一次的結果，這裡的同步 setState 是刻意的。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(undefined);
    fetchLiveRows(mode, origin, dest, timeFilter)
      .then((data) => {
        if (cancelled) return;
        setRows(data.rows);
        setError(data.error);
      })
      .catch((err) => {
        if (cancelled) return;
        setRows([]);
        setError(err instanceof Error ? err.message : "查詢失敗");
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [mode, origin, dest, timeFilter]);

  // 票價只跟車種＋起訖站有關，跟時間無關，不需要跟著 timeFilter 重新查；也不用同步清空舊值，
  // 下面只在 mode === "TRA" 時才會顯示票價卡片，切到其他運輸工具時舊資料反正不會被渲染出來。
  useEffect(() => {
    if (mode !== "TRA" || origin === dest) return;
    let cancelled = false;
    fetch(`/api/transit/tra/fare?origin=${encodeURIComponent(origin)}&dest=${encodeURIComponent(dest)}`)
      .then((res) => res.json())
      .then((data: { fares?: Partial<Record<TraFareLabel, number>> }) => {
        if (cancelled) return;
        setFares(data.fares ?? {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mode, origin, dest]);

  const meta = modeMeta[mode];
  const isLive = LIVE_MODES.includes(mode);
  const displayRows = isLive ? rows : timetableFor(mode, origin);
  const firstUpcomingIndex = displayRows.findIndex((row) => !row.isPast);
  const firstUpcomingRef = useRef<HTMLDivElement | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);

  // 列表一變（切運輸工具／站／時間）就捲到第一筆還沒過期的班次，不用自己往下滑過一堆灰階的。
  useEffect(() => {
    if (firstUpcomingIndex > 0 && firstUpcomingRef.current) scrollWithin(firstUpcomingRef.current, "center");
  }, [displayRows, firstUpcomingIndex]);

  return (
    <div ref={topRef} className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => topRef.current && scrollWithin(topRef.current, "start")}
        aria-label="回到頂部"
        // 用 inline style 設定 bottom：這個專案目前 Tailwind 沒有產生 bottom-* 這類 inset 工具類別
        // （right-6／pb-24 都有產生，唯獨 bottom-* 缺漏，原因不明），直接寫 style 比較保險。
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}
        className="fixed right-6 z-20 grid size-11 place-items-center rounded-full bg-brand text-brand-fg shadow-lg transition-opacity hover:opacity-90"
      >
        ↑
      </button>

      <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-line bg-surface p-1">
        {MODES.map((m) => {
          const mm = modeMeta[m];
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => changeMode(m)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                active ? "bg-brand text-brand-fg" : "text-muted hover:text-ink"
              }`}
            >
              {mm.label}
            </button>
          );
        })}
      </div>

      {mode === "TRA" ? (
        <>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-1 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5">
              <span className="text-xs text-muted">起站縣市</span>
              <select
                value={originCity}
                onChange={(e) => {
                  const first = traCities.find((c) => c.city === e.target.value)?.stations[0];
                  if (first) setOrigin(first.name);
                }}
                className="w-full bg-transparent text-sm outline-none"
              >
                {traCities.map((c) => (
                  <option key={c.city} value={c.city}>
                    {c.city}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5">
              <span className="text-xs text-muted">起站</span>
              <select value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-full bg-transparent text-sm outline-none">
                {(traCities.find((c) => c.city === originCity)?.stations ?? []).map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="flex flex-1 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5">
              <span className="text-xs text-muted">迄站縣市</span>
              <select
                value={destCity}
                onChange={(e) => {
                  const first = traCities.find((c) => c.city === e.target.value)?.stations[0];
                  if (first) setDest(first.name);
                }}
                className="w-full bg-transparent text-sm outline-none"
              >
                {traCities.map((c) => (
                  <option key={c.city} value={c.city}>
                    {c.city}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5">
              <span className="text-xs text-muted">迄站</span>
              <select value={dest} onChange={(e) => setDest(e.target.value)} className="w-full bg-transparent text-sm outline-none">
                {(traCities.find((c) => c.city === destCity)?.stations ?? []).map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-1 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5">
            <span className="text-xs text-muted">{mode === "Bus" ? "站牌" : "起站"}</span>
            <select value={origin} onChange={(e) => changeOrigin(e.target.value)} className="w-full bg-transparent text-sm outline-none">
              {originsForMode.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          {OD_MODES.includes(mode) && (
            <label className="flex flex-1 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5">
              <span className="text-xs text-muted">迄站</span>
              <select value={dest} onChange={(e) => setDest(e.target.value)} className="w-full bg-transparent text-sm outline-none">
                {DEST_OPTIONS[mode].filter((name) => name !== origin).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {OD_MODES.includes(mode) && (
        <div className="flex items-center gap-2">
          <label className="flex flex-1 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5">
            <span className="text-xs text-muted">時間</span>
            <input
              type="time"
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
          <Button variant="secondary" className="shrink-0 text-xs" onClick={() => setTimeFilter(nowHHmmInTaipei())}>
            現在
          </Button>
        </div>
      )}

      {mode === "TRA" && Object.keys(fares).length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-full border border-line bg-surface px-4 py-2.5 text-xs">
          {(["自強", "莒光", "區間"] as const).map(
            (label) => fares[label] !== undefined && (
              <span key={label} className="text-muted">
                {label} <span className="font-medium text-ink">NT${fares[label]}</span>
              </span>
            ),
          )}
        </div>
      )}

      <ButtonLink href="/tools/transit/routes/new" variant="secondary" className="self-start">
        ＋ 把這個站加入監控
      </ButtonLink>

      {!isLive && <p className="px-1 text-xs text-muted">目前還是示範資料，尚未串接即時到離站。</p>}

      {isLive && loading ? (
        <Card>
          <CardBody className="py-10 text-center text-sm text-muted">查詢中…</CardBody>
        </Card>
      ) : isLive && error ? (
        <Card>
          <CardBody className="py-10 text-center text-sm text-negative">{error}</CardBody>
        </Card>
      ) : displayRows.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-center text-sm text-muted">這個站目前沒有資料。</CardBody>
        </Card>
      ) : (
        <div className="flex flex-col divide-y divide-line overflow-hidden rounded-[1.5rem] border border-line bg-surface">
          {displayRows.map((row, i) => (
            <div
              key={i}
              ref={i === firstUpcomingIndex ? firstUpcomingRef : undefined}
              className={`flex items-center gap-3 px-4 py-3.5 ${row.isPast ? "opacity-50" : ""}`}
            >
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-xl text-base ${row.isPast ? "grayscale" : `${meta.bg} ${meta.fg}`}`}
              >
                {meta.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {row.time} <span className="text-muted">· {row.code}</span>
                </p>
                <p className="truncate text-xs text-muted">
                  {row.destName}
                  {row.note ? `・${row.note}` : ""}
                </p>
              </div>
              {row.delayMinutes !== undefined && (
                <Badge tone={row.delayMinutes > 0 ? "negative" : "positive"}>
                  {row.delayMinutes > 0 ? `誤點 ${row.delayMinutes} 分` : "準點"}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
