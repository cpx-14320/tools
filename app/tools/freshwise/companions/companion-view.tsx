"use client";
import { useState } from "react";
import Link from "next/link";
import { COMPANIONS, companionLevel } from "@/lib/freshwise/companions";
import { useCompanion } from "@/components/freshwise/companion-store";
import { CollectionArtwork, GameIcon, PetArtwork, SlicedArtwork } from "@/components/freshwise/game-art";
import { DewBalance, QuestSlip } from "@/components/freshwise/companion-widgets";
import { BottomSheetModal } from "@/components/freshwise/bottom-sheet-modal";
import { MeterBar, PageTitle } from "@/components/freshwise/ui";

/**
 * 夥伴頁。
 *
 * 圖鑑以前是跟「陪伴夥伴」並列的第二個頁籤，但那兩件事的性質不一樣：陪伴是這一頁的
 * 主角、每天都會看；圖鑑是偶爾打開來挑夥伴的。做成頁籤等於把主角砍掉一半的版面，
 * 而且切過去之後整頁的花園都不見了。改成標題列的一顆圖示開彈窗。
 */
export function CompanionView() {
  const { state, ready, care, select, storageAvailable } = useCompanion();
  const [bookOpen, setBookOpen] = useState(false);
  const owned = COMPANIONS.filter((p) => p.threshold <= state.stamps);
  // 等級與稱呼跟首頁共用同一份計算（lib/freshwise/companions.ts），兩頁不會再長不一樣。
  const { pet, progress, max, label } = companionLevel(state);

  return (
    <div className="fw-page fw-companions-page">
      {/* 標題跟菜籃頁、行情頁、設定頁完全一樣（遮雨棚）——用同一顆 PageTitle hanging，
          不要為這一頁另外做一個。露珠與圖鑑移到標題下面自己一列：擠在標題列裡會把
          標題牌壓窄，而且那兩顆是「這一頁的工具」，不是標題的一部分。 */}
      <PageTitle hanging>我的蔬果夥伴</PageTitle>
      <div className="fw-companion-tools">
        <DewBalance />
        <button type="button" className="fw-book-button" onClick={() => setBookOpen(true)} aria-label={`蔬果圖鑑，已結識 ${owned.length} 位`}>
          <GameIcon name="book" size={30} />
          <span>蔬果圖鑑</span>
        </button>
      </div>

      <div className="fw-companions-hero">

        {ready && (
          <>
            <section className="fw-companion-garden">
              <p className="fw-pet-speech">一起看看今天的菜價吧！</p>
              <PetArtwork id={pet.id} size={200} priority interactive className="fw-breathe" />
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
              <button type="button" className="fw-game-button" disabled={state.dew < 3} onClick={() => care("water")}>
                <GameIcon name="water" size={40} /><span className="fw-care-label">澆水 · 3 露珠</span>
              </button>
              <button type="button" className="fw-game-button fw-peach-button" disabled={state.played} onClick={() => care("play")}>
                <GameIcon name="play" size={40} />
                <span className="fw-care-label">{state.played ? "今天玩過囉" : "陪玩"}</span>
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
            {pet.code && (
              <Link className="fw-leaf-link" href={`/tools/freshwise/browse/${pet.code}`}>
                一起去看看行情 →
              </Link>
            )}
          </section>
        </>
      )}

      <QuestSlip all />
      {state.dew < 3 && <p className="fw-helper-note">完成上面的探索任務，就有露珠可以澆水。</p>}
      {/* 進度正常保存時不用特別說——那是預期行為。只有存不起來才需要告訴使用者。 */}
      {!storageAvailable && <p className="fw-helper-note">目前連不上伺服器，這次的進度可能沒辦法保存。</p>}

      <BottomSheetModal
        open={bookOpen}
        title={`蔬果圖鑑 · 已結識 ${owned.length}／${COMPANIONS.length} 位`}
        onClose={() => setBookOpen(false)}
        bodyClassName="fw-collection-book"
      >
        <p>每一次探索，都多認識一位朋友。</p>
        <div className="fw-collection-grid">
          {COMPANIONS.map((p) => {
            const unlocked = p.threshold <= state.stamps;
            return (
              <button
                type="button"
                key={p.id}
                className={`fw-collection-pet ${unlocked ? "" : "fw-pet-locked"}`}
                disabled={!unlocked}
                aria-pressed={state.active === p.id}
                onClick={() => {
                  select(p.id);
                  setBookOpen(false);
                }}
              >
                <CollectionArtwork id={p.id} size={92} />
                <strong>{p.name}</strong>
                <span>{state.active === p.id ? "陪伴中" : unlocked ? "一起陪伴 →" : `印章 ${Math.min(state.stamps, p.threshold)}／${p.threshold}`}</span>
              </button>
            );
          })}
        </div>
        <p className="fw-helper-note">完成探索就能結識，不需要購買食材。南瓜慢慢是花園夥伴，目前沒有對應的查價品項。</p>
      </BottomSheetModal>
    </div>
  );
}
