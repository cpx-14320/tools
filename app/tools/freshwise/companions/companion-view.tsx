"use client";
import { useState } from "react";
import Link from "next/link";
import { COMPANIONS, companionLevel } from "@/lib/freshwise/companions";
import { useCompanion } from "@/components/freshwise/companion-store";
import { CollectionArtwork, GameIcon, PetArtwork } from "@/components/freshwise/game-art";
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
      <div className="fw-companions-hero">
        <PageTitle
          actions={
            <span className="flex items-center gap-2">
              <DewBalance />
              <button type="button" className="fw-book-button" onClick={() => setBookOpen(true)} aria-label={`蔬果圖鑑，已結識 ${owned.length} 位`}>
                <GameIcon name="book" size={30} />
              </button>
            </span>
          }
        >
          我的蔬果夥伴
        </PageTitle>

        {ready && (
          <>
            <section className="fw-companion-garden">
              <h2>{pet.name}</h2>
              <span className="fw-level-ribbon">{label}</span>
              <p className="fw-pet-speech">一起看看今天的菜價吧！</p>
              <PetArtwork id={pet.id} size={200} priority className="fw-breathe" />
            </section>
            <section className="fw-growth">
              <div className="fw-growth-vine">
                <GameIcon name="leaf" />
                <MeterBar value={progress} max={max} label={`${progress}／${max}`} ariaLabel={`${pet.nickname}的成長 ${progress}／${max}`} />
                <GameIcon name="leaf" />
              </div>
              <p>再陪伴一點，就能升級囉。</p>
            </section>
            <div className="fw-care-actions">
              <button type="button" className="fw-game-button" disabled={state.dew < 3} onClick={() => care("water")}>
                <GameIcon name="water" size={40} />澆水 · 3 露珠
              </button>
              <button type="button" className="fw-game-button fw-peach-button" disabled={state.played} onClick={() => care("play")}>
                <GameIcon name="play" size={40} />
                {state.played ? "今天玩過囉" : "陪玩"}
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
          {state.dew < 3 && <p className="fw-helper-note">完成下面的探索任務，就有露珠可以澆水。每天第一次陪玩也能增加成長。</p>}
        </>
      )}

      <QuestSlip all />
      <p className="fw-helper-note">
        {storageAvailable ? "夥伴與任務進度跟著你的帳號，換手機、換瀏覽器都會在。" : "目前連不上伺服器，這次的進度可能沒辦法保存。"}
      </p>

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
                <CollectionArtwork id={p.id} />
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
