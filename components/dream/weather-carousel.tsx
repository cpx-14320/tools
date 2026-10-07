"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ImageSlot } from "./image-slot";
import { ICON_PATHS } from "./icon-paths";

// 使用者自訂、可以新增任意多個「區塊」——每個區塊就是一個縣市＋行政區。輪播的那一層是
// 「今天／明天」，不是逐個地區各自一張卡：每一則輪播卡會把目前所有區塊的資料一起並排
// 顯示（2 個區塊就是左右兩格，像原本出發／抵達並排的樣子），左右滑動切換的是「今天」
// 跟「明天」這兩天，不是切換到別的地區。
export interface WeatherBlock {
  id: string;
  city: string;
  district: string;
}

// 今天／明天兩張輪播卡中間的間距（px）——拖曳切換時中間會露出這段背景，不會兩張卡
// 緊貼在一起；平移距離要連這段間距一起算進去（見下面 translateX 的 calc），不然卡片會
// 疊到彼此身上或切換後對不齊視窗邊緣。
const CARD_GAP_PX = 8;

const DAY_OFFSETS = [0, 1] as const;
const DAY_LABEL: Record<(typeof DAY_OFFSETS)[number], string> = { 0: "今天", 1: "明天" };

interface WeatherInfo {
  icon: string;
  label: string;
  temp: number;
  pop?: number;
}

const WEATHER_ICONS = [ICON_PATHS.weatherSunny, ICON_PATHS.weatherCloudy, ICON_PATHS.weatherRain];
const WEATHER_LABELS = ["晴天", "多雲", "小雨"];
const WEATHER_ICON_BY_BUCKET: Record<string, string> = {
  sunny: ICON_PATHS.weatherSunny,
  cloudy: ICON_PATHS.weatherCloudy,
  rain: ICON_PATHS.weatherRain,
};

// 查詢「失敗」時（不是還在查詢中）才用縣市名稱算一個固定（非隨機）的假天氣頂著畫面，
// 避免整張卡壞掉時是空的；查詢中要顯示「載入中」，不能先塞這組假資料，不然等真資料
// 回來會整個跳掉、看起來像資料閃爍。
function mockWeather(city: string): WeatherInfo {
  let hash = 0;
  for (const ch of city) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  const idx = hash % WEATHER_LABELS.length;
  return { icon: WEATHER_ICONS[idx], label: WEATHER_LABELS[idx], temp: 20 + (hash % 10), pop: hash % 101 };
}

function useCityWeather(city: string, district: string, dayOffset: number): WeatherInfo | null {
  const [info, setInfo] = useState<WeatherInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    // city/district/dayOffset 一變就要重新查，故意同步把上一次的結果清掉讓畫面回到
    // 查詢中狀態，不是在訂閱外部事件、也不會連鎖觸發其他 effect，屬於這個規則容許的例外。
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setInfo(null);
    fetch(`/api/weather/forecast?city=${encodeURIComponent(city)}&district=${encodeURIComponent(district)}&dayOffset=${dayOffset}`)
      .then((res) => res.json())
      .then((data: { bucket?: string; label?: string; temp?: number; pop?: number; error?: string }) => {
        if (cancelled) return;
        if (data.error || data.temp === undefined || !data.bucket) {
          setInfo(mockWeather(city));
          return;
        }
        setInfo({ icon: WEATHER_ICON_BY_BUCKET[data.bucket] ?? ICON_PATHS.weatherCloudy, label: data.label ?? "未知", temp: data.temp, pop: data.pop });
      })
      .catch(() => {
        if (!cancelled) setInfo(mockWeather(city));
      });
    return () => {
      cancelled = true;
    };
  }, [city, district, dayOffset]);

  return info;
}

/** 查詢中的卡片骨架——連 city/district 那行文字都一起灰掉，不要讓使用者在其他兩行還是
 *  骨架的時候就先看到這行文字，看起來像只有一部分在載入、一部分已經載入好的不一致狀態。 */
function WeatherCardSkeleton() {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-[#F3EFFC] p-3">
      <div className="size-10 shrink-0 animate-pulse rounded-lg bg-[#E4DBF9]" />
      <div className="min-w-0 flex-1">
        <div className="h-[11px] w-16 animate-pulse rounded-full bg-[#E4DBF9]" />
        <div className="mt-1 h-[11px] w-10 animate-pulse rounded-full bg-[#E4DBF9]" />
        <div className="mt-1 h-[12px] w-16 animate-pulse rounded-full bg-[#E4DBF9]" />
      </div>
    </div>
  );
}

function WeatherCard({ block, dayOffset }: { block: WeatherBlock; dayOffset: 0 | 1 }) {
  const weather = useCityWeather(block.city, block.district, dayOffset);

  if (!weather) return <WeatherCardSkeleton />;

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-[#F3EFFC] p-3">
      <ImageSlot src={weather.icon} alt={weather.label} className="size-10 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] text-[#9C94C4]">
          {block.city} {block.district}
        </p>
        {weather.pop !== undefined && <p className="truncate text-[11px] text-[#9C94C4]">降雨機率 {weather.pop}%</p>}
        <p className="truncate text-[12px] font-semibold text-[#4A3B7C]">
          {weather.temp}°C・{weather.label}
        </p>
      </div>
    </div>
  );
}

/** 自己用 pointer 事件做拖曳＋貫性歸位的輪播，不是單靠 CSS scroll-snap——scroll-snap
 *  只有觸控裝置的原生滑動手勢才會動，桌面滑鼠用拖曳不會觸發捲動，桌面測試/操作時會
 *  完全沒反應。這裡改成用 translateX 自己算位移，滑鼠拖曳跟手指觸控都走同一套邏輯，
 *  放手時依拖曳距離決定留在原張還是切到下一張／上一張，再補一個過渡動畫做歸位。 */
export function WeatherCarousel({ blocks }: { blocks: WeatherBlock[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartX = useRef(0);

  const safeIndex = Math.min(index, DAY_OFFSETS.length - 1);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    dragStartX.current = e.clientX;
    setDragging(true);
    containerRef.current?.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setDragOffset(e.clientX - dragStartX.current);
  }

  function endDrag() {
    if (!dragging) return;
    const width = containerRef.current?.clientWidth ?? 1;
    const threshold = width * 0.2;
    if (dragOffset <= -threshold) setIndex((i) => Math.min(DAY_OFFSETS.length - 1, i + 1));
    else if (dragOffset >= threshold) setIndex((i) => Math.max(0, i - 1));
    setDragOffset(0);
    setDragging(false);
  }

  if (blocks.length === 0) {
    return <p className="rounded-2xl bg-[#F3EFFC] px-3 py-4 text-center text-xs text-[#B3ABD4]">還沒有設定天氣地區，點右上角編輯新增</p>;
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-center gap-1.5">
        {DAY_OFFSETS.map((dayOffset, i) => (
          <span key={dayOffset} className={`text-[10px] font-medium ${i === safeIndex ? "text-[#6F5FD6]" : "text-[#C7BFE6]"}`}>
            {DAY_LABEL[dayOffset]}
          </span>
        ))}
      </div>
      <div
        ref={containerRef}
        className="touch-pan-y select-none overflow-hidden rounded-2xl"
        style={{ cursor: dragging ? "grabbing" : "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="flex gap-2"
          style={{
            transform: `translateX(calc(${-safeIndex * 100}% + ${-safeIndex * CARD_GAP_PX}px + ${dragOffset}px))`,
            transition: dragging ? "none" : "transform 280ms ease",
          }}
        >
          {DAY_OFFSETS.map((dayOffset) => (
            <div key={dayOffset} className="grid w-full shrink-0 grid-cols-2 gap-2">
              {blocks.map((block) => (
                <WeatherCard key={block.id} block={block} dayOffset={dayOffset} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 給還沒讀完使用者偏好設定（連要顯示哪些縣市區塊都還不知道）的情況用，跟 WeatherCard
 *  loading 時的骨架共用同一份 markup。 */
export function WeatherCarouselSkeleton() {
  return (
    <div>
      {/* 「今天／明天」是固定的輪播 UI，不等天氣資料或使用者偏好載入才顯示。
          這樣 skeleton 切換成正式資料時，上方標題不會跟著消失／重新出現，版面高度也比較穩定。 */}
      <div className="mb-1.5 flex items-center justify-center gap-1.5">
        <span className="text-[10px] font-medium text-[#6F5FD6]">今天</span>
        <span className="text-[10px] font-medium text-[#C7BFE6]">明天</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <WeatherCardSkeleton />
        <WeatherCardSkeleton />
      </div>
    </div>
  );
}