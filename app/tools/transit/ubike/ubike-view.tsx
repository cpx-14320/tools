"use client";

import { useEffect, useState } from "react";
import { FaIcon } from "@/components/transit/fa-icon";
import { BottomSheetModal } from "@/components/transit/bottom-sheet-modal";
import { NearbyButton } from "@/components/transit/nearby-button";
import { UBIKE_CITIES } from "@/components/transit/ubike-cities";
import { scrollContainerToTop } from "@/lib/scroll-within";
import { formatDistance } from "@/lib/geo";
import { Badge, DividedCard, ErrorText, Field, FieldRow, Hint, Note, PageTitle, PillButton, SelectButton, TextInput } from "@/components/transit/ui";
import { copy, text } from "@/components/transit/theme";
import { DividedRowsSkeleton } from "@/components/transit/skeleton";
import { loadSkeletonCount, saveSkeletonCount } from "@/components/transit/skeleton-count";

const CITIES = UBIKE_CITIES;

interface UbikeStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/** null＝這一站查不到即時資料（TDX 沒回傳、或站點暫停營運），不要顯示成「0」。 */
interface UbikeAvailability {
  availableRent: number;
  availableReturn: number;
}

interface NearbyStation extends UbikeStation {
  cityName?: string;
  distanceMeters: number;
  availability: UbikeAvailability | null;
}

// 「附近站點」顯示的筆數上限——定位一次之後附近幾十公尺到幾公里內的站點就夠用，
// 不用把排序完的幾百筆全塞進畫面。排序、裁切都在伺服器端做完（見
// app/api/transit/ubike/nearby），這裡只是告訴它要幾筆。
const NEARBY_LIMIT = 20;

// 骨架列數記憶：附近站點的筆數很固定（就是上面這個上限），依縣市瀏覽的筆數則是每個縣市
// 自己的站點數——都記住上次的實際筆數，載入中畫出一樣多的列（設計系統規定骨架數量要跟
// 載入完的實際數量一致；真的很長的清單會被 loadSkeletonCount 裁到 12 列，超出的部分本來
// 就在第一屏之外，看不到高度跳動）。
const NEARBY_COUNT_KEY = "cpx-tools:transit:ubike-nearby-count";
const cityCountKey = (city: string) => `cpx-tools:transit:ubike-city-count:${city}`;

function googleMapsHref(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
}

function availabilityBadgeTone(count: number): string {
  return count > 0 ? "bg-[#E3F6EC] text-[#2FAE82]" : "bg-[#FDEEF0] text-[#D1517E]";
}

/** 站點清單的單一列，附近站點／依縣市瀏覽兩種模式共用同一份外觀。
 *  availability 故意用三態：undefined＝這個模式根本沒查即時資料（依縣市瀏覽），不顯示
 *  這一塊；null＝查了但這一站沒有資料（可能暫停營運），顯示提示文字；物件＝正常顯示
 *  可借／可還數字——跟畫面上「查無資料」跟「真的是 0」要分清楚是同一個理由。 */
function StationRow({
  station,
  distance,
  availability,
}: {
  station: UbikeStation;
  distance?: string;
  availability?: UbikeAvailability | null;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#F3EFFC]">
        <FaIcon icon="bicycle" size={16} className="text-[#6F5FD6]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`truncate ${text.bodyStrong}`}>{station.name}</p>
        {distance && <p className={`mt-0.5 ${text.meta}`}>{distance}</p>}
        {availability !== undefined &&
          (availability ? (
            <div className="mt-1 flex items-center gap-1.5">
              <Badge className={availabilityBadgeTone(availability.availableRent)}>可借 {availability.availableRent}</Badge>
              <Badge className={availabilityBadgeTone(availability.availableReturn)}>可還 {availability.availableReturn}</Badge>
            </div>
          ) : (
            <p className={`mt-1 ${text.meta}`}>目前無即時車輛資料</p>
          ))}
      </div>
      {/* 不自己畫地圖／路線，直接把使用者丟去 Google Maps 導航——這件事 Google Maps
          做得比自己刻一套好，見跟使用者討論過的理由。跟「我的行程」卡片右邊「搜尋
          班次」按鈕同一顆元件，維持列表列尾按鈕的視覺語言一致。 */}
      <PillButton as="a" href={googleMapsHref(station.lat, station.lng)}>
        立即導航 →
      </PillButton>
    </div>
  );
}

export function UbikeView() {
  const [cityName, setCityName] = useState("");
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [stations, setStations] = useState<UbikeStation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [citySkeletonCount, setCitySkeletonCount] = useState(0);
  const [nearbySkeletonCount, setNearbySkeletonCount] = useState(0);

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

  useEffect(() => {
    // 掛載後才讀得到 localStorage（伺服器端渲染那一次沒有，初始值要跟瀏覽器端一致才不會
    // hydration 不匹配）。
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setNearbySkeletonCount(loadSkeletonCount(NEARBY_COUNT_KEY, 0));
  }, []);

  useEffect(() => {
    if (!cityName) return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setCitySkeletonCount(loadSkeletonCount(cityCountKey(cityName), 0));
  }, [cityName]);

  // 拿到座標後交給伺服器查——縣市粗篩（使用者的位置可能剛好在兩個縣市交界，只查單一縣市
  // 會漏掉其實比較近的另一邊站點）、排序、裁切全部在伺服器端做完。以前是前端對 11 個
  // 縣市各發一次請求，把整包站點座標拉回瀏覽器才開始算距離。
  useEffect(() => {
    if (!nearbyCoords) return;
    let cancelled = false;
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setNearbyStations(null);
    const qs = new URLSearchParams({ lat: String(nearbyCoords.lat), lng: String(nearbyCoords.lng), limit: String(NEARBY_LIMIT) });
    fetch(`/api/transit/ubike/nearby?${qs.toString()}`)
      .then((res) => res.json())
      .then((data: { stations?: NearbyStation[]; error?: string }) => {
        if (cancelled) return;
        if (data.error) {
          setNearbyError(data.error);
          setNearbyStations([]);
          return;
        }
        const list = data.stations ?? [];
        setNearbyStations(list);
        saveSkeletonCount(NEARBY_COUNT_KEY, list.length);
      })
      .catch(() => {
        if (cancelled) return;
        setNearbyError(copy.failed("附近站點"));
        setNearbyStations([]);
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
          const list = data.stations ?? [];
          setStations(list);
          // 只記「整個縣市」的筆數（沒有搜尋關鍵字時），打字篩選出來的筆數每次都不一樣，
          // 記了反而讓下次的骨架更不準。
          if (!trimmed) saveSkeletonCount(cityCountKey(cityName), list.length);
        })
        .catch(() => {
          if (!cancelled) setError(copy.queryFailed);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cityName, query, nearbyActive]);

  return (
    <div className="flex flex-col px-5 pb-6 pt-6">
      <PageTitle
        actions={<NearbyButton active={nearbyActive} locating={locating} label="附近站點" onClick={nearbyActive ? cancelNearby : requestNearby} />}
      >
        Ubike
      </PageTitle>
      {/* 即時可借／可還車輛數只有「附近站點」才查（見 lib/transit/ubike.ts 的說明：依縣市
          瀏覽動輒上百站，一次性查詢車輛數對這個情境沒意義，只有真的要馬上出發的「附近」
          才需要）——所以這句說明只在依縣市瀏覽模式顯示，附近站點模式不顯示（因為那裡
          本來就有車輛數可看，這句話在那個情境下會變成錯誤資訊）。 */}
      {!nearbyActive && <Note className="mt-1">查詢站點位置，不含即時可借還車輛數。</Note>}
      {nearbyError && <ErrorText center className="mt-2">{nearbyError}</ErrorText>}

      {nearbyActive ? (
        <div className="mt-4">
          <DividedCard>
            {nearbyStations === null ? (
              nearbySkeletonCount === 0 ? (
                <Hint center className="px-4 py-6">
                  {copy.searching}
                </Hint>
              ) : (
                // 附近站點現在多了第三行車輛數徽章，骨架列數跟著加到 3 行，不然資料
                // 回來時列高會變高、版面往下跳一截。
                <DividedRowsSkeleton count={nearbySkeletonCount} iconSize={36} lines={3} />
              )
            ) : nearbyStations.length === 0 ? (
              <Hint center className="px-4 py-6">
                附近沒有查到站點
              </Hint>
            ) : (
              nearbyStations.map((s) => (
                <StationRow key={s.id} station={s} distance={formatDistance(s.distanceMeters)} availability={s.availability} />
              ))
            )}
          </DividedCard>
        </div>
      ) : (
        <>
          {/* 11 個縣市橫向捲動要滑很長，而且不容易注意到還能往右滑；改成跟首頁日期／時間
              同一套「標籤＋按鈕開彈窗」寫法，點了跳出跟其他選擇器一樣的 BottomSheetModal，
              不用瀏覽器原生 <select>（展開樣式是系統內建的，跟這個 App 的視覺對不起來）。
              跟搜尋框並排成一排，兩個框線／圓角用同一套樣式，看起來是同一組篩選條件。 */}
          <FieldRow className="mt-4 gap-3">
            <Field as="div" label="縣市">
              <SelectButton value={cityName} placeholder="請選擇" onClick={() => setCityPickerOpen(true)} />
            </Field>

            <Field label="站名">
              <TextInput type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜尋站名" className="px-3" />
            </Field>
          </FieldRow>

          {/* 還沒選縣市、或選了縣市但查詢還沒回來，都不要用跟搜尋結果一樣的白底卡片包著——
              那樣看起來像是「查過了、但是空的」，容易被誤會成查詢結果；單純文字置左、不加
              卡片外框，才看得出來是「根本還沒開始查」。真的有東西要顯示（錯誤訊息、查無
              結果、或站點清單）才用原本的卡片樣式。 */}
          {!cityName ? (
            <Hint className="mt-4">還沒有任何資料</Hint>
          ) : error ? (
            // error 要排在 stations === null 前面檢查——查詢失敗時 stations 本來就會一直是
            // null（effect 裡失敗只設 error，沒有把 stations 設成別的值），放在後面的話
            // 下面那支 stations === null 分支永遠先成立，錯誤訊息永遠顯示不出來。
            <div className="mt-4">
              <DividedCard>
                <ErrorText center className="px-4 py-6">
                  {error}
                </ErrorText>
              </DividedCard>
            </div>
          ) : stations === null ? (
            // 骨架列數＝這個縣市上次實際的站點數（上限 12 列），不是一行「載入中」文字——
            // 清單出現時版面才不會整塊往下推。
            <div className="mt-4">
              {citySkeletonCount === 0 ? (
                <Hint>{copy.loading}</Hint>
              ) : (
                <DividedCard>
                  <DividedRowsSkeleton count={citySkeletonCount} iconSize={36} lines={1} />
                </DividedCard>
              )}
            </div>
          ) : (
            <div className="mt-4">
              <DividedCard>
                {stations.length === 0 ? (
                  <Hint center className="px-4 py-6">
                    沒有符合的站點
                  </Hint>
                ) : (
                  stations.map((s) => <StationRow key={s.id} station={s} />)
                )}
              </DividedCard>
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
