function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Haversine 公式算兩個經緯度之間的距離（公尺）——地球半徑用平均值 6371 公里，這個應用
// 場景（站點導航用的距離排序）不需要更精確的橢球模型。
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} 公尺` : `${(m / 1000).toFixed(1)} 公里`;
}
