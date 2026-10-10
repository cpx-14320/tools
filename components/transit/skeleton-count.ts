// 給「使用者自己增減的清單」（備忘錄、主視覺、橫幅…）用：這些清單的筆數會變動，骨架
// 不能寫死固定幾列——不然資料回來那一刻，骨架列數跟實際內容數量對不上，畫面高度會跳
// 一下。用 localStorage 記住「上次成功載入時的實際筆數」，下次還沒抓到資料前先用這個
// 數字猜骨架列數，猜對的機率比寫死一個數字高很多；完全沒存過（第一次使用）才退回
// fallback。

export function loadSkeletonCount(key: string, fallback: number): number {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n > 0 ? Math.min(n, 8) : fallback;
  } catch {
    return fallback;
  }
}

export function saveSkeletonCount(key: string, count: number) {
  try {
    if (count > 0) localStorage.setItem(key, String(count));
    else localStorage.removeItem(key);
  } catch {
    // localStorage 不可用（例如無痕模式）就放棄，不影響功能，下次還是用 fallback 猜。
  }
}
