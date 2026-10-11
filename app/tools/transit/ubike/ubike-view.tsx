"use client";

import { useEffect, useState } from "react";
import { FaIcon } from "@/components/transit/fa-icon";
import { BottomSheetModal } from "@/components/transit/bottom-sheet-modal";
import { UBIKE_CITIES } from "@/components/transit/ubike-cities";
import { scrollContainerToTop } from "@/lib/scroll-within";

const CITIES = UBIKE_CITIES;

interface UbikeStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

interface NearbyStation extends UbikeStation {
  distanceMeters: number;
}

// 「附近站點」顯示的筆數上限——定位一次之後附近幾十公尺到幾公里內的站點就夠用，
// 不用把排序完的幾百筆全塞進畫面。
const NEARBY_LIMIT = 20;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Haversine 公式算兩個經緯度之間的距離（公尺）——地球半徑用平均值 6371 公里，這個應用
// 場景（站點導航用的距離排序）不需要更精確的橢球模型。
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} 公尺` : `${(m / 1000).toFixed(1)} 公里`;
}

function googleMapsHref(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
}

/** 站點清單的單一列，附近站點／依縣市瀏覽兩種模式共用同一份外觀，只差要不要顯示距離。 */
function StationRow({ station, distance }: { station: UbikeStation; distance?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#F3EFFC]">
        <FaIcon icon="bicycle" size={16} className="text-[#6F5FD6]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#4A3B7C]">{station.name}</p>
        {distance && <p className="mt-0.5 text-xs text-[#9C94C4]">{distance}</p>}
      </div>
      {/* 不自己畫地圖／路線，直接把使用者丟去 Google Maps 導航——這件事 Google Maps
          做得比自己刻一套好，見跟使用者討論過的理由。跟「我的行程」卡片右邊「搜尋
          班次」按鈕同一套樣式，維持列表列尾按鈕的視覺語言一致。 */}
      <a
        href={googleMapsHref(station.lat, station.lng)}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-full bg-[#F3EFFC] px-3 py-1.5 text-xs font-medium text-[#6F5FD6]"
      >
        立即導航 →
      </a>
    </div>
  );
}

export function UbikeView() {
  const [cityName, setCityName] = useState("");
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [stations, setStations] = useState<UbikeStation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 附近站點：GPS 定位會改變畫面顯示的資料，所以不在進頁面時自動要求權限，要使用者自己
  // 點按鈕才觸發——瀏覽器的定位權限彈窗跳出來時，使用者剛好知道「我要的就是這個」，
  // 而不是一進頁面就莫名其妙跳出一個權限要求。
  const [locating, setLocating] = useState(false);
  const [nearbyCoords, setNearbyCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbyStations, setNearbyStations] = useState<NearbyStation[] | null>(null);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const nearbyActive = nearbyCoords !== null;

  function requestNearby() {
    if (!navigator.geolocation) {
      setNearbyError("這個瀏覽器不支援定位功能");
      return;
    }
    setLocating(true);
    setNearbyError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setNearbyCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setLocating(false);
        setNearbyError(err.code === err.PERMISSION_DENIED ? "請到瀏覽器設定開啟定位權限" : "定位失敗，請稍後再試");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function cancelNearby() {
    setNearbyCoords(null);
    setNearbyStations(null);
    setNearbyError(null);
  }

  // 拿到座標後查全部縣市的站點（不是只查目前選的那個 tab）再依距離排序——使用者站的
  // 位置可能剛好在兩個縣市交界，只查單一縣市會漏掉其實比較近的另一邊站點。
  useEffect(() => {
    if (!nearbyCoords) return;
    let cancelled = false;
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setNearbyStations(null);
    Promise.all(
      CITIES.map((city) =>
        fetch(`/api/transit/ubike/stations?city=${encodeURIComponent(city)}`)
          .then((res) => res.json())
          .then((data: { stations?: UbikeStation[] }) => data.stations ?? [])
          .catch(() => []),
      ),
    ).then((lists) => {
      if (cancelled) return;
      const merged = lists
        .flat()
        .map((s) => ({ ...s, distanceMeters: distanceMeters(nearbyCoords.lat, nearbyCoords.lng, s.lat, s.lng) }))
        .sort((a, b) => a.distanceMeters - b.distanceMeters)
        .slice(0, NEARBY_LIMIT);
      setNearbyStations(merged);
    });
    return () => {
      cancelled = true;
    };
  }, [nearbyCoords]);

  // 依縣市瀏覽：切縣市／打字都重新查，debounce 200ms 跟公車站牌搜尋同一套做法，不用每個
  // 按鍵都打一次。附近站點開啟時這個查詢沒有意義（畫面改顯示附近清單），略過不打。
  // 還沒選縣市就不查（API 需要 city 參數）；選了縣市但還沒打字，就列出整個縣市——平常不騎
  // Ubike 的人選了縣市通常也答不出要打什麼站名，search-only 反而讓這種「純瀏覽」的人
  // 什麼都看不到，而且也不是人人都是「人在現場、可以用附近站點」這種情境。
  useEffect(() => {
    if (nearbyActive) return;
    if (!cityName) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setStations([]);
      setError(null);
      return;
    }

    const trimmed = query.trim();
    let cancelled = false;
    setStations(null);
    setError(null);
    const timer = setTimeout(() => {
      const qs = new URLSearchParams({ city: cityName, q: trimmed });
      fetch(`/api/transit/ubike/stations?${qs.toString()}`)
        .then((res) => res.json())
        .then((data: { stations?: UbikeStation[]; error?: string }) => {
          if (cancelled) return;
          if (data.error) {
            setError(data.error);
            return;
          }
          setStations(data.stations ?? []);
        })
        .catch(() => {
          if (!cancelled) setError("查詢失敗，請稍後再試");
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cityName, query, nearbyActive]);

  return (
    <div className="flex flex-col px-5 pb-6 pt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#4A3B7C]">Ubike</h1>
          <p className="mt-1 text-xs text-[#9C94C4]">查詢站點位置，不含即時可借還車輛數。</p>
        </div>
        <button
          type="button"
          onClick={nearbyActive ? cancelNearby : requestNearby}
          disabled={locating}
          className={`flex shrink-0 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ${
            nearbyActive ? "bg-[#F3EFFC] text-[#6F5FD6]" : "bg-[#6F5FD6] text-white"
          }`}
        >
          <FaIcon icon={nearbyActive ? "xmark" : "location-dot"} className={nearbyActive ? "text-[#6F5FD6]" : "text-white"} />
          {locating ? "定位中…" : nearbyActive ? "取消定位" : "附近站點"}
        </button>
      </div>
      {nearbyError && <p className="mt-2 text-center text-xs text-[#D1517E]">{nearbyError}</p>}

      {nearbyActive ? (
        <div className="mt-4 flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl bg-white shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)]">
          {nearbyStations === null ? (
            <p className="px-4 py-6 text-center text-sm text-[#B3ABD4]">查詢附近站點中…</p>
          ) : nearbyStations.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[#B3ABD4]">附近沒有查到站點</p>
          ) : (
            nearbyStations.map((s) => <StationRow key={s.id} station={s} distance={formatDistance(s.distanceMeters)} />)
          )}
        </div>
      ) : (
        <>
          {/* 11 個縣市橫向捲動要滑很長，而且不容易注意到還能往右滑；改成跟首頁日期／時間
              同一套「標籤＋按鈕開彈窗」寫法，點了跳出跟其他選擇器一樣的 BottomSheetModal，
              不用瀏覽器原生 <select>（展開樣式是系統內建的，跟這個 App 的視覺對不起來）。
              跟搜尋框並排成一排，兩個框線／圓角用同一套樣式，看起來是同一組篩選條件。 */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[#9C94C4]">縣市</span>
              <button
                type="button"
                onClick={() => setCityPickerOpen(true)}
                className="flex items-center gap-2 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3 text-left text-sm text-[#4A3B7C]"
              >
                <span className={`flex-1 truncate ${cityName ? "font-medium" : "text-[#C7BFE6]"}`}>{cityName || "請選擇"}</span>
                <FaIcon icon="chevron-down" size={12} className="text-[#C7BFE6]" />
              </button>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[#9C94C4]">站名</span>
              <div className="flex items-center gap-2 rounded-2xl border border-[#ECE4FA] bg-white px-3 py-3">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜尋站名"
                  className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-[#C7BFE6]"
                />
              </div>
            </label>
          </div>

          {/* 還沒選縣市、或選了縣市但查詢還沒回來，都不要用跟搜尋結果一樣的白底卡片包著——
              那樣看起來像是「查過了、但是空的」，容易被誤會成查詢結果；單純文字置左、不加
              卡片外框，才看得出來是「根本還沒開始查」或「正在查」。真的有東西要顯示（錯誤
              訊息、查無結果、或站點清單）才用原本的卡片樣式。 */}
          {!cityName ? (
            <p className="mt-4 text-sm text-[#B3ABD4]">還沒有任何資料</p>
          ) : error ? (
            // error 要排在 stations === null 前面檢查——查詢失敗時 stations 本來就會一直是
            // null（effect 裡失敗只設 error，沒有把 stations 設成別的值），放在後面的話
            // 下面那支 stations === null 分支永遠先成立，錯誤訊息永遠顯示不出來。
            <div className="mt-4 flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)]">
              <p className="px-4 py-6 text-center text-sm text-[#D1517E]">{error}</p>
            </div>
          ) : stations === null ? (
            <p className="mt-4 text-sm text-[#B3ABD4]">載入中…</p>
          ) : (
            <div className="mt-4 flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl bg-white shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)]">
              {stations.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-[#B3ABD4]">沒有符合的站點</p>
              ) : (
                stations.map((s) => <StationRow key={s.id} station={s} />)
              )}
            </div>
          )}
        </>
      )}

      {((nearbyActive && (nearbyStations?.length ?? 0) > 0) || (!nearbyActive && (stations?.length ?? 0) > 0)) && (
        // 跟搜尋結果頁「回到頂部」同一顆按鈕：TransitMobileShell 卡片容器本身有 transform，
        // 是這個 fixed 按鈕的定位基準（不是整個瀏覽器視窗），right-5／bottom 直接貼齊卡片
        // 邊界。一個縣市動輒上百筆站點，捲到底下想回頂端重選縣市／搜尋時很需要這顆按鈕。
        <button
          type="button"
          onClick={() => {
            const main = document.querySelector("main");
            if (main) scrollContainerToTop(main, "smooth");
          }}
          aria-label="回到頂部"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)", background: "linear-gradient(90deg, #8A7CEE, #6F5FD6)" }}
          className="fixed right-5 z-20 grid size-11 place-items-center rounded-full shadow-[0_8px_20px_-6px_rgba(111,95,214,0.6)] transition-opacity hover:opacity-90"
        >
          <FaIcon icon="arrow-up" size={18} className="text-white" />
        </button>
      )}

      <BottomSheetModal open={cityPickerOpen} title="選擇縣市" onClose={() => setCityPickerOpen(false)} bodyClassName="flex flex-col gap-2 px-5 py-4">
        {CITIES.map((city) => (
          <button
            key={city}
            type="button"
            onClick={() => {
              setCityName(city);
              setCityPickerOpen(false);
            }}
            className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
              city === cityName ? "border-[#6F5FD6] bg-[#F3EFFC] text-[#6F5FD6]" : "border-[#ECE4FA] text-[#4A3B7C] hover:bg-[#F3EFFC]"
            }`}
          >
            {city}
          </button>
        ))}
      </BottomSheetModal>
    </div>
  );
}
