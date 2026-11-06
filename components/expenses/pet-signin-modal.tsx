"use client";

import { Modal } from "./modal";
import { IconImg } from "./icon-img";
import { ICON_PATHS } from "./icon-paths";
import { text } from "./theme";
import { SIGNIN_STREAK_CAP, signinCoins } from "@/lib/expenses/pet";

/** 簽到：進養成頁就自動簽到（見 settlePetRewards），所以這裡是「結果」不是「按鈕」——
 *  它要回答的是「我連幾天了、今天拿到多少、明天會拿多少」。
 *
 *  本來是頁面上固定的一張卡，但簽到是每天看一次就夠的資訊，卻佔著跟角色同一條捲軸；
 *  改成場地下面那排入口的第一顆，要看的時候才打開。 */
export function PetSigninModal({
  open,
  onClose,
  /** 今天是連續簽到的第幾天（0 ＝ 今天還沒簽到）。 */
  streak,
}: {
  open: boolean;
  onClose: () => void;
  streak: number;
}) {
  const signedInToday = streak > 0;

  return (
    <Modal open={open} onClose={onClose} title="每日簽到">
      <div className="flex items-center justify-between gap-2">
        <p className={text.sectionHeading}>連續簽到</p>
        <span className="text-xs font-semibold tabular-nums text-[#6F5FD6]">
          {signedInToday ? `今天 ＋${signinCoins(streak)}` : "今天還沒簽到"}
        </span>
      </div>
      <p className={`mt-0.5 ${text.muted}`}>
        {signedInToday
          ? streak >= SIGNIN_STREAK_CAP
            ? `已連續 ${streak} 天，每天都是 ${signinCoins(SIGNIN_STREAK_CAP)} 顆`
            : `已連續 ${streak} 天，明天連上去是 ＋${signinCoins(streak + 1)}`
          : "打開這一頁就會自動簽到"}
      </p>
      {/* 格子畫的是「這一輪連續簽到的進度」，不是最近七天的日曆：第一天就在第一格，
          斷掉就回到第一格，連滿 SIGNIN_STREAK_CAP 天之後一直停在最後一格。
          本來是「N 天前／今天」的日曆排法，但那排在講的是哪一天有沒有簽到，跟上面
          那句「已連續 N 天，明天連上去是 ＋X」問的不是同一件事——使用者要看的是
          「我走到第幾格了、下一格有多少」，所以改成直接標第幾天。 */}
      <div className="mt-3 flex gap-1.5">
        {Array.from({ length: SIGNIN_STREAK_CAP }, (_, i) => {
          const day = i + 1;
          // streak 超過上限之後一律停在最後一格（第 8 天起獎勵也不再往上加）。
          const current = Math.min(streak, SIGNIN_STREAK_CAP);
          const done = day <= current;
          const isCurrent = day === current;
          return (
            <div key={day} className="flex flex-1 flex-col items-center gap-1">
              <span
                className={`grid h-8 w-full place-items-center rounded-xl text-[11px] font-semibold tabular-nums ${
                  done ? "bg-[#6F5ED4] text-white" : "bg-[#F3EFFC] text-[#C7BFE6]"
                }`}
              >
                {done && <IconImg src={ICON_PATHS.petStar} alt="已簽到" size={16} background={false} />}
              </span>
              <span className={`text-[10px] ${isCurrent ? "font-semibold text-[#6F5FD6]" : text.faint}`}>第 {day} 天</span>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
