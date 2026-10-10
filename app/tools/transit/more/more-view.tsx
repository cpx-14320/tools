"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { TOOLS_REGISTRY } from "@/lib/tools-registry";
import { ImageSlot } from "@/components/transit/image-slot";
import { FaIcon } from "@/components/transit/fa-icon";
import { ListRowSkeleton } from "@/components/transit/list-row-skeleton";
import { loadSkeletonCount, saveSkeletonCount } from "@/components/transit/skeleton-count";
import { HERO_BANNER_IMAGE_OPTIONS, WEEKEND_TRIP_IMAGE_OPTIONS } from "@/components/transit/caption-image-options";
import { CaptionImageEditorModal, type CaptionImageDraft, type CaptionImageInitial } from "@/components/transit/caption-image-editor-modal";

const CURRENT_TOOL_ID = "transit";

// 主視覺／橫幅都是使用者自己增減的清單，跟我的行程的分類／行程同一套做法：骨架列數
// 照這個使用者上次實際存的筆數猜，不要固定寫死；完全沒存過（包含剛建立的新帳號）才
// 退回 0——退回 0 時 Array.from 會是空陣列、畫面上顯示不出骨架，交給下面的「載入中」
// 文字頂著，不要誤猜成「至少有 2 組」害畫面跳動。
const HERO_COUNT_KEY = "cpx-tools:transit:hero-banners-count";
const WEEKEND_COUNT_KEY = "cpx-tools:transit:weekend-trips-count";
// 「其他小工具」雖然不是使用者自己增減、是依帳號權限決定的清單，但一樣可能最後只有
// 「目前沒有其他小工具的使用權限」這一段文字，不是真的清單——同一套骨架筆數猜測機制，
// 不要在權限還沒讀出來前先顯示一排看起來「有東西」的假骨架。
const OTHER_TOOLS_COUNT_KEY = "cpx-tools:transit:other-tools-count";

export function MoreView() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  // 「其他小工具」只列使用者真的有權限、而且不是目前這個工具（搭乘車查詢）的項目。
  const otherTools = TOOLS_REGISTRY.filter((t) => t.toolId !== CURRENT_TOOL_ID && (user?.tools ?? []).includes(t.toolId));
  const [otherToolsSkeletonCount, setOtherToolsSkeletonCount] = useState(0);

  // 首頁「橫幅」每次進頁面隨機顯示的那幾組文案＋背景圖，在這頁統一編輯。
  const [weekendTrips, setWeekendTrips] = useState<CaptionImageInitial[]>([]);
  const [weekendReady, setWeekendReady] = useState(false);
  const [weekendEditorOpen, setWeekendEditorOpen] = useState(false);
  // 骨架列數的初始值只能先給固定的 0（伺服器端渲染那一次沒有 localStorage，跟瀏覽器端
  // 算出來的結果要一致才不會 hydration 不匹配），掛載後才用下面那個 effect 翻成真的
  // 猜測值，理由跟首頁 weatherReady 那段完全一樣。
  const [weekendSkeletonCount, setWeekendSkeletonCount] = useState(0);

  // 首頁最上方「主視覺」每次進頁面隨機顯示的文案＋背景圖，邏輯跟橫幅一樣。
  const [heroBanners, setHeroBanners] = useState<CaptionImageInitial[]>([]);
  const [heroReady, setHeroReady] = useState(false);
  const [heroEditorOpen, setHeroEditorOpen] = useState(false);
  const [heroSkeletonCount, setHeroSkeletonCount] = useState(0);

  useEffect(() => {
    // 跟首頁套用 localStorage 存的預設值同一種例外：掛載後才讀得到 localStorage，讀到就要
    // 立刻套用這組猜測值，不是在訂閱外部事件、也不會連鎖觸發其他 effect。
    /* eslint-disable react-hooks/set-state-in-effect */
    setHeroSkeletonCount(loadSkeletonCount(HERO_COUNT_KEY, 0));
    setWeekendSkeletonCount(loadSkeletonCount(WEEKEND_COUNT_KEY, 0));
    setOtherToolsSkeletonCount(loadSkeletonCount(OTHER_TOOLS_COUNT_KEY, 0));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // useAuth() 的 user/loading 不是這個元件自己發的 fetch，沒有地方可以在「拿到結果那一刻」
  // 順手存筆數，只能用 effect 盯著 loading 變成 false 那一刻存一次。
  useEffect(() => {
    if (!loading) saveSkeletonCount(OTHER_TOOLS_COUNT_KEY, otherTools.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/transit/weekend-trips")
      .then((res) => res.json())
      .then((data: { items?: CaptionImageInitial[] }) => {
        if (cancelled) return;
        const items = data.items ?? [];
        setWeekendTrips(items);
        setWeekendReady(true);
        saveSkeletonCount(WEEKEND_COUNT_KEY, items.length);
      })
      .catch(() => {
        if (!cancelled) setWeekendReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/transit/hero-banners")
      .then((res) => res.json())
      .then((data: { items?: CaptionImageInitial[] }) => {
        if (cancelled) return;
        const items = data.items ?? [];
        setHeroBanners(items);
        setHeroReady(true);
        saveSkeletonCount(HERO_COUNT_KEY, items.length);
      })
      .catch(() => {
        if (!cancelled) setHeroReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function saveWeekendTrips(drafts: CaptionImageDraft[]) {
    fetch("/api/transit/weekend-trips", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: drafts }),
    })
      .then((res) => res.json())
      .then((data: { items?: CaptionImageInitial[] }) => {
        const items = data.items ?? [];
        setWeekendTrips(items);
        saveSkeletonCount(WEEKEND_COUNT_KEY, items.length);
      })
      .catch(() => {});
    setWeekendEditorOpen(false);
  }

  function saveHeroBanners(drafts: CaptionImageDraft[]) {
    fetch("/api/transit/hero-banners", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: drafts }),
    })
      .then((res) => res.json())
      .then((data: { items?: CaptionImageInitial[] }) => {
        const items = data.items ?? [];
        setHeroBanners(items);
        saveSkeletonCount(HERO_COUNT_KEY, items.length);
      })
      .catch(() => {});
    setHeroEditorOpen(false);
  }

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <div className="flex flex-col px-5 pb-6 pt-6">
      <h1 className="text-xl font-bold text-[#4A3B7C]">設定</h1>

      <div className="mt-5 flex flex-col gap-5">
        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs font-medium text-[#9C94C4]">主視覺</p>
            <button type="button" onClick={() => setHeroEditorOpen(true)} aria-label="編輯主視覺">
              <FaIcon icon="pen" size={12} />
            </button>
          </div>
          <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl bg-white shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)]">
            {!heroReady ? (
              heroSkeletonCount === 0 ? (
                // 沒有上次記住的筆數可以猜（新帳號、或從來沒存過）時骨架列數是 0，
                // Array.from 出來是空陣列、畫面上什麼都不會顯示，額外補一個「載入中」文字。
                <p className="px-4 py-3 text-sm text-[#B3ABD4]">載入中…</p>
              ) : (
                Array.from({ length: heroSkeletonCount }, (_, i) => (
                  <div key={i} className="px-4 py-3">
                    <ListRowSkeleton />
                  </div>
                ))
              )
            ) : heroBanners.length === 0 ? (
              <p className="px-4 py-3 text-sm text-[#B3ABD4]">還沒設定，首頁目前顯示預設的文案跟背景圖</p>
            ) : (
              heroBanners.map((b) => (
                <div key={b.id} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <ImageSlot src={b.image} alt={b.title} className="size-10 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#4A3B7C]">{b.title}</p>
                    <p className="truncate text-xs text-[#9C94C4]">{b.caption}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs font-medium text-[#9C94C4]">橫幅</p>
            <button type="button" onClick={() => setWeekendEditorOpen(true)} aria-label="編輯橫幅">
              <FaIcon icon="pen" size={12} />
            </button>
          </div>
          <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl bg-white shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)]">
            {!weekendReady ? (
              weekendSkeletonCount === 0 ? (
                <p className="px-4 py-3 text-sm text-[#B3ABD4]">載入中…</p>
              ) : (
                Array.from({ length: weekendSkeletonCount }, (_, i) => (
                  <div key={i} className="px-4 py-3">
                    <ListRowSkeleton />
                  </div>
                ))
              )
            ) : weekendTrips.length === 0 ? (
              <p className="px-4 py-3 text-sm text-[#B3ABD4]">還沒設定，首頁目前顯示預設的文案跟背景圖</p>
            ) : (
              weekendTrips.map((t) => (
                <div key={t.id} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <ImageSlot src={t.image} alt={t.title} className="size-10 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#4A3B7C]">{t.title}</p>
                    <p className="truncate text-xs text-[#9C94C4]">{t.caption}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 px-1 text-xs font-medium text-[#9C94C4]">其他小工具</p>
          <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl bg-white shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)]">
            {loading ? (
              otherToolsSkeletonCount === 0 ? (
                <p className="px-4 py-3 text-sm text-[#B3ABD4]">載入中…</p>
              ) : (
                Array.from({ length: otherToolsSkeletonCount }, (_, i) => (
                  <div key={i} className="px-4 py-3">
                    <ListRowSkeleton iconSize={40} lines={1} />
                  </div>
                ))
              )
            ) : otherTools.length === 0 ? (
              <p className="px-4 py-3 text-sm text-[#B3ABD4]">目前沒有其他小工具的使用權限</p>
            ) : (
              otherTools.map((tool) => (
                <Link key={tool.toolId} href={tool.href} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  {tool.iconImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tool.iconImage} alt={tool.name} className="size-10 shrink-0 object-contain" />
                  ) : (
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#F3EFFC] text-lg">{tool.icon}</span>
                  )}
                  <span className="flex-1 text-sm text-[#4A3B7C]">{tool.name}</span>
                  <span aria-hidden className="text-[#C7BFE6]">
                    ›
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-medium text-[#D1517E] shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)]"
        >
          登出
        </button>
      </div>

      <CaptionImageEditorModal
        key={heroEditorOpen ? "hero-open" : "hero-closed"}
        open={heroEditorOpen}
        heading="編輯主視覺"
        description="首頁最上方的大張插畫 Banner，每次進頁面／重新整理會從下面這幾組裡隨機挑一組顯示標題、文案跟背景圖。"
        itemLabel="組"
        imageOptions={HERO_BANNER_IMAGE_OPTIONS}
        initial={heroBanners}
        onClose={() => setHeroEditorOpen(false)}
        onSave={saveHeroBanners}
      />

      <CaptionImageEditorModal
        key={weekendEditorOpen ? "weekend-open" : "weekend-closed"}
        open={weekendEditorOpen}
        heading="編輯橫幅"
        description="首頁「橫幅」每次進頁面／重新整理會從下面這幾組裡隨機挑一組顯示標題、文案跟背景圖。"
        itemLabel="組"
        imageOptions={WEEKEND_TRIP_IMAGE_OPTIONS}
        initial={weekendTrips}
        onClose={() => setWeekendEditorOpen(false)}
        onSave={saveWeekendTrips}
      />
    </div>
  );
}
