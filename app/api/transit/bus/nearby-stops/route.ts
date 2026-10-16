import { NextResponse } from "next/server";
import { getNearbyBusStops } from "@/lib/transit/bus-routing";
import { API_CACHE, jsonCached } from "@/lib/transit/api-cache";

// 「附近站牌」改成一次請求搞定：伺服器端依座標粗篩出附近幾個縣市、合併去重、依距離排序
// 裁到前 limit 筆再回傳。以前是前端對 10 個縣市各發一次 /bus/stop-locations，把整包站牌
// 座標都拉回瀏覽器才開始算距離——TDX 每分鐘只有 5 次額度，冷快取時那 10 個請求註定有
// 一半以上失敗，而且傳回來的資料有 99% 是算完距離就丟掉的。
const NEARBY_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const limitParam = Number(params.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.round(limitParam), MAX_LIMIT) : NEARBY_LIMIT;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ stops: [], error: "缺少或不合法的 lat／lng 參數" }, { status: 400 });
  }

  try {
    const stops = await getNearbyBusStops(lat, lng, limit);
    // 使用者站著不動時重新定位（或切回這個分頁）會送出幾乎一樣的座標，短時間內讓瀏覽器
    // 直接用快取回答就好；座標只要變一點點 URL 就不同，不會拿到別的位置的結果。
    return jsonCached({ stops }, API_CACHE.realtime);
  } catch (err) {
    return NextResponse.json({ stops: [], error: err instanceof Error ? err.message : "附近站牌查詢失敗，請稍後再試" }, { status: 502 });
  }
}
