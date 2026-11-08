"use client";

import { PetModal, PetModalButton } from "./pet-modal";
import { SIGNIN_STREAK_CAP, signinCoins } from "@/lib/expenses/pet";

/** 一格「第 N 天」。三種狀態各自一張畫好的底圖：
 *    已簽到 pet-day-signed（紫底）＋ 右上角打勾
 *    今天   pet-day-today（粉框，這一格是現在進行式）
 *    還沒到 pet-day-default（淡底）
 *  底圖是 192×192 的正方形，格子用 aspect-square 跟著欄寬縮放。 */
function DayTile({ day, state }: { day: number; state: "signed" | "today" | "future" }) {
  const bg = state === "signed" ? "pet-day-signed" : state === "today" ? "pet-day-today" : "pet-day-default";
  const label = state === "signed" ? "已簽到" : state === "today" ? "今日" : "未簽到";
  return (
    <div
      className="relative grid aspect-square place-items-center bg-contain bg-center bg-no-repeat"
      style={{ backgroundImage: `url("/expenses/${bg}.png")` }}
    >
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[11px] font-bold text-[#5B3B8C]">第 {day} 天</span>
        <span className="size-7 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: 'url("/expenses/pet-star.png")' }} />
        <span className={`text-[10px] ${state === "future" ? "text-[#B9A3D6]" : "text-[#8A6BBE]"}`}>{label}</span>
      </div>
      {state === "signed" && (
        <span
          aria-hidden
          className="absolute -right-1 -top-1 size-5 bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: 'url("/expenses/pet-day-checkmark.png")' }}
        />
      )}
    </div>
  );
}

/** 簽到要自己按底下那顆「今日簽到」——不是打開記帳本就自動算（那是改版前的做法，
 *  結果這個彈窗裡的按鈕永遠是「已簽到」，使用者沒有任何事情可做）。按下去才發星星幣，
 *  連續天數也才是自己累積出來的。
 *
 *  格子畫的是「這一輪連續簽到的進度」，不是最近七天的日曆：第一天就在第一格，斷掉就回到
 *  第一格，連滿 SIGNIN_STREAK_CAP 天之後一直停在最後一格。使用者要看的是「我走到第幾格、
 *  下一格有多少」，不是「哪一天有沒有簽到」。
 *
 *  最後一天獨立成一條橫的：它是這一輪的大獎（寶箱），跟前面六格排在一起會被當成第七個
 *  一樣的格子。 */
export function PetSigninModal({
  open,
  onClose,
  /** 今天是連續簽到的第幾天（0 ＝ 今天還沒簽到）。 */
  streak,
  onSignIn,
}: {
  open: boolean;
  onClose: () => void;
  streak: number;
  onSignIn: () => void;
}) {
  const signedInToday = streak > 0;
  // streak 超過上限之後一律停在最後一格（第 8 天起獎勵也不再往上加）。
  const current = Math.min(streak, SIGNIN_STREAK_CAP);
  // 已經走過的格子都是「已簽到」；今天還沒簽到的話，下一格（current + 1）就是「今日」。
  // 已經簽到的那一天不另外標「今日」——它就是最後一個打勾的格子（比照參考稿的 after 狀態）。
  const dayState = (day: number): "signed" | "today" | "future" =>
    day <= current ? "signed" : !signedInToday && day === current + 1 ? "today" : "future";

  return (
    <PetModal
      open={open}
      onClose={onClose}
      title="每日簽到"
      subtitle="每天回來，累積小小成長"
      footer={
        <PetModalButton tone={signedInToday ? "secondary" : "primary"} disabled={signedInToday} onClick={onSignIn}>
          {signedInToday ? "今日已簽到" : "今日簽到"}
        </PetModalButton>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: SIGNIN_STREAK_CAP - 1 }, (_, i) => (
          <DayTile key={i + 1} day={i + 1} state={dayState(i + 1)} />
        ))}
      </div>

      {/* 第 SIGNIN_STREAK_CAP 天：連滿一輪的大獎，橫的一條＋寶箱。 */}
      {/* 這一條是自己畫的（圓角＋金色描邊），沒有沿用 pet-day-default 那張圖：那是 192×192
          的正方形，拉成三倍寬的長條之後圓角跟內側的亮面都會跟著變形。 */}
      <div className="flex items-center gap-3 rounded-2xl border-2 border-[#EFC14F] bg-[#FDF2DA] px-4 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-[#5B3B8C]">第 {SIGNIN_STREAK_CAP} 天</span>
          <span className="block text-[11px] text-[#8A6BBE]">
            {current >= SIGNIN_STREAK_CAP ? `已連滿，每天都是 ${signinCoins(SIGNIN_STREAK_CAP)} 顆` : `連滿可拿 ${signinCoins(SIGNIN_STREAK_CAP)} 顆`}
          </span>
        </span>
        <span className="size-11 shrink-0 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: 'url("/expenses/pet-rewardchest.png")' }} />
      </div>

      <p className="text-center text-[11px] text-[#9C7FC0]">
        第 {Math.max(current, 1)} 天 ・{" "}
        {signedInToday
          ? current >= SIGNIN_STREAK_CAP
            ? `今天也有好好陪伴，＋${signinCoins(SIGNIN_STREAK_CAP)}`
            : `今天也有好好陪伴，＋${signinCoins(current)}；明天連上去是 ＋${signinCoins(current + 1)}`
          : "今日尚未簽到"}
      </p>
    </PetModal>
  );
}
