"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { COMPANIONS, companionLevel, levelOf, PET_STAGES, unlockedStage, WATER_DEW_COST } from "@/lib/freshwise/companions";
import { useCompanion } from "@/components/freshwise/companion-store";
import { GameIcon, PetArtwork, PetStageArtwork, SlicedArtwork } from "@/components/freshwise/game-art";
import { DewBalance, QuestSlip } from "@/components/freshwise/companion-widgets";
import { BottomSheetModal } from "@/components/freshwise/bottom-sheet-modal";
import { MeterBar, PageTitle } from "@/components/freshwise/ui";
import { cx } from "@/components/freshwise/theme";
import type { PetReactionHandle } from "@/components/freshwise/pet-interaction";
import type { PetCareAction } from "@/lib/freshwise/pet-expressions";
import { petLookStage } from "@/lib/freshwise/pet-expressions";

/**
 * 夥伴頁。
 *
 * 圖鑑以前是跟「陪伴夥伴」並列的第二個頁籤，但那兩件事的性質不一樣：陪伴是這一頁的
 * 主角、每天都會看；圖鑑是偶爾打開來挑夥伴的。做成頁籤等於把主角砍掉一半的版面，
 * 而且切過去之後整頁的花園都不見了。改成標題列的一顆圖示開彈窗。
 */
export function CompanionView() {
  const { state, ready, care, select, chooseLook, storageAvailable } = useCompanion();
  const [bookOpen, setBookOpen] = useState(false);
  const petReaction = useRef<PetReactionHandle>(null);

  /** 動畫只在**真的發生**的時候播。
   *
   *  以前這裡自己用 `state.dew < WATER_DEW_COST` 判斷再無條件播動畫，但 `state` 是 React
   *  state——連點時同一批事件裡它可能還是舊的，於是最後一下會「澆水動畫播了，提示卻寫著
   *  露珠不夠」。真正的把關在 store 的 `care()`（讀同步更新的 ref），這裡只看它的回傳值。
   *  按鈕的 disabled 仍然用 state，那是給眼睛看的，不是把關。 */
  function handleCare(action: PetCareAction) {
    if (care(action)) petReaction.current?.react(action);
  }
  const owned = COMPANIONS.filter((p) => p.threshold <= state.stamps);
  // 等級與稱呼跟首頁共用同一份計算（lib/freshwise/companions.ts），兩頁不會再長不一樣。
  const { pet, progress, max, label } = companionLevel(state);

  return (
    <div className="fw-page fw-companions-page">
      {/* 標題跟菜籃頁、行情頁、設定頁完全一樣（遮雨棚）——用同一顆 PageTitle hanging，
          不要為這一頁另外做一個。露珠與圖鑑移到標題下面自己一列：擠在標題列裡會把
          標題牌壓窄，而且那兩顆是「這一頁的工具」，不是標題的一部分。 */}
      {/* 花園背景從頁面最上緣開始、**穿過遮雨棚後面**：標題與遮雨棚包在 hero 裡面，
          背景的 :before 用負 z-index 躺在它們下面。這一頁的主角是花園，讓天空接到
          頂端比在遮雨棚下方切一條邊自然。 */}
      <div className="fw-companions-hero">
        <PageTitle hanging>我的蔬果夥伴</PageTitle>
        <div className="fw-companion-tools">
          <DewBalance />
          <button type="button" className="fw-book-button" onClick={() => setBookOpen(true)} aria-label={`圖鑑，已結識 ${owned.length} 位`}>
            <GameIcon name="book" size={30} />
            <span>圖鑑</span>
          </button>
        </div>

        {ready && (
          <>
            <section className="fw-companion-garden">
              <p className="fw-pet-speech">一起看看今天的菜價吧！</p>
              <PetArtwork id={pet.id} stage={petLookStage(state, pet.id)} size={200} priority interactive reactionRef={petReaction} className="fw-breathe" />
              {/* 小尺寸等級牌接在角色下方，與成長進度保持緊湊。 */}
              <span className="fw-level-ribbon"><SlicedArtwork name="companion-level-ribbon" className="fw-sliced-ribbon"/>{label}</span>
            </section>
            <section className="fw-growth">
              <div className="fw-growth-vine">
                <GameIcon name="leaf" />
                <div className="fw-growth-meter-frame"><SlicedArtwork name="companion-growth-frame"/><MeterBar value={progress} max={max} label={`${progress}／${max}`} ariaLabel={`${pet.nickname}的成長 ${progress}／${max}`} /></div>
                <GameIcon name="leaf" />
              </div>
              <p>再陪伴一點，就能升級囉。</p>
            </section>
            <div className="fw-care-actions">
              <button type="button" className="fw-game-button" disabled={state.dew < WATER_DEW_COST} onClick={() => handleCare("water")}>
                <GameIcon name="water" size={40} /><span className="fw-care-label">澆水 · {WATER_DEW_COST} 露珠</span>
              </button>
              <button type="button" className="fw-game-button fw-peach-button" disabled={state.played} onClick={() => handleCare("play")}>
                <GameIcon name="play" size={40} />
                <span className="fw-care-label">{state.played ? "今天玩過囉" : "陪牠玩耍"}</span>
              </button>
            </div>
          </>
        )}
      </div>

      {!ready ? (
        <p className="fw-loading" role="status">
          夥伴正在準備小花園…
        </p>
      ) : (
        <>
          <section className="fw-diary">
            <h2>
              <GameIcon name="leaf" size={30} />
              {pet.nickname}的小日記
            </h2>
            <p>{pet.story}</p>
            {/* 六位夥伴都對應得到一個查價品項（南瓜補上 FF1 之後），不用再判斷有沒有。 */}
            <Link className="fw-leaf-link" href={`/tools/freshwise/browse/${pet.code}`}>
              一起去看看行情 →
            </Link>
          </section>
        </>
      )}

      <QuestSlip all />
      {/* 進度正常保存時不用特別說——那是預期行為。只有存不起來才需要告訴使用者。 */}
      {!storageAvailable && <p className="fw-helper-note">目前連不上伺服器，這次的進度可能沒辦法保存。</p>}

      <BottomSheetModal
        open={bookOpen}
        title={`圖鑑 · 已結識 ${owned.length}／${COMPANIONS.length} 位`}
        onClose={() => setBookOpen(false)}
        bodyClassName="fw-collection-book"
      >
        <p>每一次探索，都多認識一位朋友。點一下成長階段，就能換成那個時候的樣子。</p>
        <div className="fw-collection-list">
          {COMPANIONS.map((p) => {
            const unlocked = p.threshold <= state.stamps;
            const petLevel = levelOf(state.growth[p.id]);
            const reached = unlockedStage(petLevel);
            const showing = petLookStage(state, p.id);
            const active = state.active === p.id;
            return (
              <div key={p.id} className={cx("fw-collection-card", !unlocked && "fw-pet-locked")}>
                <div className="fw-collection-card-head">
                  <strong>{p.name}</strong>
                  {unlocked ? (
                    <span>{active ? `陪伴中 · Lv.${petLevel}` : `Lv.${petLevel}`}</span>
                  ) : (
                    <span>{`印章 ${Math.min(state.stamps, p.threshold)}／${p.threshold}`}</span>
                  )}
                </div>

                {/* 三個階段**都畫出來**，還沒拿到的那幾階用「沒取得」的樣子（淡化去色，跟還沒
                    結識的夥伴同一種處理）。看得到後面長什麼樣才有繼續養的理由；拿到了才變彩色。 */}
                <div className="fw-collection-stages">
                  {PET_STAGES.map(({ stage, label, from }) => {
                    const got = unlocked && stage <= reached;
                    // 綠框＝「畫面上正在顯示的就是這一張」，所以只有**陪伴中那一隻**的當前
                    // 階段會亮。其他夥伴各自也有自己的外觀選擇（state.look），但它們沒有被
                    // 畫在花園裡——每隻都亮一格綠框，使用者會以為同時選了好幾個。
                    const chosen = got && active && showing === stage;
                    return (
                      <button
                        type="button"
                        key={stage}
                        className={cx("fw-collection-stage", !got && "fw-stage-locked", chosen && "fw-stage-chosen")}
                        disabled={!got}
                        aria-pressed={chosen}
                        aria-label={`${p.name} ${label}${!unlocked ? "，還沒結識這位夥伴" : !got ? `，Lv.${from} 解鎖` : chosen ? "，正在使用" : "，換成這個樣子"}`}
                        onClick={() => {
                          // **點階段就是全部的操作**：換成這隻夥伴 ＋ 用這一階的樣子。
                          // 原本底下還有一顆「換牠來陪伴 →」，但那跟點階段做的是同一件事，
                          // 兩個入口做同一件事只會讓人猶豫該按哪一個。
                          if (!active) select(p.id);
                          // 已經在用的那一階再點一次＝回到「跟等級走」，升級就會自動換新樣子。
                          // （只有陪伴中那一隻會有 chosen，所以切換夥伴時一律是「選這一階」。）
                          chooseLook(p.id, chosen && stage === reached ? 0 : stage);
                        }}
                      >
                        <PetStageArtwork id={p.id} stage={stage} size={72} />
                        <small>{got || !unlocked ? label : `Lv.${from}`}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </BottomSheetModal>
    </div>
  );
}
