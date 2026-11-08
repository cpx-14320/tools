"use client";

import { PetModal, PetModalButton } from "./pet-modal";
import {
  BUDGET_KEPT_COINS,
  EGG_HATCH_SPRITE,
  ENTRY_COINS,
  PET_HATCH_LEVEL,
  SIGNIN_STREAK_CAP,
  SPRITE_COLS,
  SPRITE_ROWS,
  petOutfitSprite,
  signinCoins,
} from "@/lib/expenses/pet";

/** 成長三階段的其中一格。圖是精靈圖裁出來的某一格，不是另外出的插圖——這樣之後換角色
 *  圖，說明裡的示意圖會自己跟著換。 */
function StageCell({ src, col, row, label }: { src: string; col: number; row: number; label: string }) {
  const x = (col / (SPRITE_COLS - 1)) * 100;
  const y = (row / (SPRITE_ROWS - 1)) * 100;
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        aria-hidden
        className="size-14 bg-no-repeat"
        style={{ backgroundImage: `url("${src}")`, backgroundSize: `${SPRITE_COLS * 100}% ${SPRITE_ROWS * 100}%`, backgroundPosition: `${x}% ${y}%` }}
      />
      <span className="text-[11px] font-bold text-[#5B3B8C]">{label}</span>
    </div>
  );
}

/** 說明裡的一列：左邊一張小圖、右邊標題＋一行說明。 */
function HelpRow({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    // 圓角長條是自己畫的，不沿用 pet-day-* 那幾張方形圖——那些拉成長條會讓圓角跟亮面變形。
    <div className="flex items-center gap-3 rounded-2xl border-2 border-[#C9A8E8] bg-white/70 px-3 py-2.5">
      <span aria-hidden className="size-9 shrink-0 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url("${icon}")` }} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-[#5B3B8C]">{title}</span>
        <span className="block text-[11px] leading-relaxed text-[#7A5CAE]">{children}</span>
      </span>
    </div>
  );
}

/** 養成頁右上角那顆問號開的說明。
 *
 *  內容是「這一頁怎麼運作」：角色會長大、怎麼餵、星星幣從哪來。數字一律從 lib 的常數
 *  帶出來，不要在文案裡寫死——獎勵調整時不會忘了改這裡。 */
export function PetHelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <PetModal
      open={open}
      onClose={onClose}
      title="養成說明"
      subtitle="慢慢陪伴，看見每一點成長"
      footer={<PetModalButton onClick={onClose}>知道了</PetModalButton>}
    >
      {/* 蛋 → 破殼 → 長大。中間那格直接取孵化動畫裡正在破殼的那一格。 */}
      <div className="flex items-center justify-center gap-2">
        <StageCell src={petOutfitSprite("outfit-egg")} col={0} row={0} label="蛋的時期" />
        <span aria-hidden className="pb-4 text-lg text-[#C7AEE8]">›</span>
        <StageCell src={EGG_HATCH_SPRITE} col={3} row={1} label="孵化時刻" />
        <span aria-hidden className="pb-4 text-lg text-[#C7AEE8]">›</span>
        <StageCell src={petOutfitSprite("outfit-laboratory")} col={0} row={0} label="一起成長" />
      </div>

      <HelpRow icon="/expenses/pet-food-noodle.png" title="餵食與經驗">
        點食物餵角色，價格跟經驗值一比一——花掉多少星星幣就換回多少經驗值。
      </HelpRow>
      <HelpRow icon="/expenses/pet-star.png" title="星星幣怎麼來">
        每日簽到 ＋{signinCoins(1)}（連續到第 {SIGNIN_STREAK_CAP} 天是 ＋{signinCoins(SIGNIN_STREAK_CAP)}）、每記一筆帳 ＋{ENTRY_COINS}、
        上個月每個分類都沒超支 ＋{BUDGET_KEPT_COINS}。只看記帳習慣，不看你有多少錢。
      </HelpRow>
      <HelpRow icon="/expenses/pet-rewardchest.png" title="孵化與換裝">
        Lv.{PET_HATCH_LEVEL} 破殼之後就能換造型；衣服可以先買起來放，等孵化了再到背包換上。
      </HelpRow>
    </PetModal>
  );
}
