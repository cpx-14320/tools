// TDX 時刻表相關的小型時間工具，給 app/api/transit/** 的 route handler 共用。

export function todayInTaipei(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" }); // YYYY-MM-DD
}

export function nowHHmmInTaipei(): string {
  return new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit" });
}

/** 兩個 "HH:mm" 時間字串相差幾分鐘；終點時間字面上比起點小就當作跨午夜，加一天處理。 */
export function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.slice(0, 5).split(":").map(Number);
  const [eh, em] = end.slice(0, 5).split(":").map(Number);
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff < 0 ? diff + 24 * 60 : diff;
}

export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h} 時 ${m} 分` : `${m} 分`;
}
