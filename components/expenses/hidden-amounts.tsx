"use client";

import { useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "cpx-tools:expenses-amounts-hidden";

/** 遮起來時顯示的字樣——保留 NT$ 前綴，看得出這一格本來就是金額、只是被蓋住了。
 *
 *  只有星號縮成 text-sm，NT$ 維持原本的字級：整行一起縮小的話，遮起來跟打開來的那
 *  一行高度不一樣，卡片會忽高忽矮；星號本身比數字寬，不縮的話又會把卡片撐開。 */
const MaskedAmount = (
  <>
    NT$ <span className="text-sm">＊＊＊＊</span>
  </>
);

/** 「把首頁的金額遮起來」的開關，記在這台裝置上。
 *
 *  在外面（捷運上、辦公室）打開記帳本的時候，結餘、收入、支出、淨資產這幾個數字是最
 *  不想被旁邊的人看到的。遮住的只有畫面，資料照常載入、圖表跟清單照常計算，按一下就
 *  看得回來——這不是密碼鎖，只是擋一眼。
 *
 *  初始值一律是「不遮」、localStorage 等掛載後才讀：這頁在伺服器端也會先算繪一次，而
 *  伺服器沒有 localStorage，在 useState 的初始值裡讀會讓兩邊的 HTML 對不起來（hydration
 *  失敗）。同 date-filter-context.tsx 的處理。 */
export function useHiddenAmounts() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      if (localStorage.getItem(STORAGE_KEY) === "1") setHidden(true);
    } catch {
      /* 私密視窗等情況，忽略，用預設值 */
    }
  }, []);

  function toggle() {
    const next = !hidden;
    setHidden(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* 忽略 */
    }
  }

  /** 要顯示的金額——遮起來時換成星號（見 MaskedAmount）。 */
  function mask(value: string): ReactNode {
    return hidden ? MaskedAmount : value;
  }

  return { hidden, toggle, mask };
}

/** 眼睛按鈕：睜眼＝現在看得到（按下去會遮起來），閉眼＝現在遮著。 */
export function HiddenAmountsToggle({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={hidden ? "顯示金額" : "隱藏金額"}
      aria-pressed={hidden}
      className="grid size-8 shrink-0 place-items-center rounded-full text-[#9C94C4] hover:bg-[#F3EFFC] hover:text-[#6F5FD6]"
    >
      <EyeIcon closed={hidden} />
    </button>
  );
}

function EyeIcon({ closed }: { closed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="size-5">
      {closed ? (
        <>
          {/* 閉眼＝下垂的弧線加幾根睫毛，跟睜眼那組線條粗細一致。 */}
          <path d="M3 10c2.5 3.2 5.5 4.8 9 4.8S18.5 13.2 21 10" />
          <path d="M5 13.4 3.6 15.6M9.3 15.4 8.6 17.9M14.7 15.4l.7 2.5M19 13.4l1.4 2.2" />
        </>
      ) : (
        <>
          <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
          <circle cx="12" cy="12" r="2.8" />
        </>
      )}
    </svg>
  );
}
