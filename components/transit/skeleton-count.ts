// 給「使用者自己增減的清單」（備忘錄、常用行程、主視覺、橫幅…）用：這些清單的筆數會
// 變動，骨架不能寫死固定幾列——不然資料回來那一刻，骨架列數跟實際內容數量對不上，畫面
// 高度會跳一下。用 localStorage 記住「上次成功載入時的實際筆數」，下次還沒抓到資料前
// 先用這個數字猜骨架列數，猜對的機率比寫死一個數字高很多；完全沒存過（第一次使用）才
// 退回 fallback。
//
// 設計系統規定骨架數量要跟實際顯示數量相同，所以上限放寬到 MAX_SKELETON（12 列）——
// 更長的清單（Ubike 一個縣市上百個站點、台鐵一天上百班車）超出的部分本來就在第一屏
// 看不到的位置，少畫幾列不會造成看得見的高度跳動，但畫上百列骨架會讓載入本身變慢。

const MAX_SKELETON = 12;

export function loadSkeletonCount(key: string, fallback: number, max: number = MAX_SKELETON): number {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n > 0 ? Math.min(n, max) : fallback;
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

/** 巢狀清單（「我的行程」是分類底下再掛行程）的骨架形狀：每個分類各自有幾列。
 *  以前只記「總共幾個分類」「總共幾筆行程」，骨架是用總數除以分類數平均分配——分類
 *  筆數不平均時（例如上班 3 筆、假日 1 筆）每個分類的骨架列數就跟實際對不上。改成直接
 *  記住每個分類各自的筆數陣列，載入完成前畫出來的形狀就跟載入完一模一樣。 */
export function loadSkeletonShape(key: string, max: number = MAX_SKELETON): number[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const counts = parsed.filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0).map((n) => Math.min(n, max));
    return counts.length > 0 ? counts.slice(0, max) : null;
  } catch {
    return null;
  }
}

export function saveSkeletonShape(key: string, counts: number[]) {
  try {
    if (counts.length > 0) localStorage.setItem(key, JSON.stringify(counts));
    else localStorage.removeItem(key);
  } catch {
    // 同上，存不進去就放著，下次用 fallback 猜。
  }
}
