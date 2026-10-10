"use client";

import { useEffect, useState } from "react";
import { FaIcon } from "@/components/transit/fa-icon";
import { YOUBIKE_CITIES } from "@/components/transit/youbike-cities";

const CITIES = YOUBIKE_CITIES;

interface YouBikeStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

interface NearbyStation extends YouBikeStation {
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
function StationRow({ station, distance }: { station: YouBikeStation; distance?: string }) {
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

export function YouBikeView() {
  const [cityName, setCityName] = useState(CITIES[0]);
  const [query, setQuery] = useState("");
  const [stations, setStations] = useState<YouBikeStation[] | null>(null);
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
        fetch(`/api/transit/youbike/stations?city=${encodeURIComponent(city)}`)
          .then((res) => res.json())
          .then((data: { stations?: YouBikeStation[] }) => data.stations ?? [])
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
  // 還沒輸入站名就不查——一個縣市動輒幾百個站點，整包列出來資料量太多，使用者實際上只
  // 會待在其中一小塊區域；要嘛打站名篩，要嘛用上面的「附近站點」依位置篩，兩種都比
  // 「列出整個縣市」更貼近使用者真正想找的範圍。
  useEffect(() => {
    if (nearbyActive) return;

    const trimmed = query.trim();
    if (!trimmed) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setStations([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setStations(null);
    setError(null);
    const timer = setTimeout(() => {
      const qs = new URLSearchParams({ city: cityName, q: trimmed });
      fetch(`/api/transit/youbike/stations?${qs.toString()}`)
        .then((res) => res.json())
        .then((data: { stations?: YouBikeStation[]; error?: string }) => {
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
      <h1 className="text-xl font-bold text-[#4A3B7C]">YouBike</h1>
      <p className="mt-1 text-xs text-[#9C94C4]">查詢站點位置，不含即時可借還車輛數。</p>

      <button
        type="button"
        onClick={nearbyActive ? cancelNearby : requestNearby}
        disabled={locating}
        className={`mt-4 flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ${
          nearbyActive ? "bg-[#F3EFFC] text-[#6F5FD6]" : "bg-[#6F5FD6] text-white"
        }`}
      >
        <FaIcon icon={nearbyActive ? "xmark" : "location-dot"} className={nearbyActive ? "text-[#6F5FD6]" : "text-white"} />
        {locating ? "定位中…" : nearbyActive ? "取消定位" : "附近站點"}
      </button>
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
          <div className="-mx-5 mt-4 flex gap-1.5 overflow-x-auto px-5 pb-0.5">
            {CITIES.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => setCityName(city)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  cityName === city ? "bg-[#6F5FD6] text-white" : "bg-[#F3EFFC] text-[#9C94C4]"
                }`}
              >
                {city}
              </button>
            ))}
          </div>

          <label className="mt-3 flex items-center gap-2 rounded-full border border-[#ECE4FA] bg-white px-4 py-2.5">
            <FaIcon icon="magnifying-glass" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋站名"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[#C7BFE6]"
            />
          </label>

          <div className="mt-4 flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl bg-white shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)]">
            {stations === null ? (
              <p className="px-4 py-6 text-center text-sm text-[#B3ABD4]">載入中…</p>
            ) : error ? (
              <p className="px-4 py-6 text-center text-sm text-[#D1517E]">{error}</p>
            ) : !query.trim() ? (
              <p className="px-4 py-6 text-center text-sm text-[#B3ABD4]">輸入站名開始查詢，或用上面的「附近站點」依位置篩選</p>
            ) : stations.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[#B3ABD4]">沒有符合的站點</p>
            ) : (
              stations.map((s) => <StationRow key={s.id} station={s} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}
