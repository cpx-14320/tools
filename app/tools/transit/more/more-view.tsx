"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { TOOLS_REGISTRY } from "@/lib/tools-registry";
import { ImageSlot } from "@/components/dream/image-slot";
import { FaIcon } from "@/components/dream/fa-icon";
import { ICON_PATHS } from "@/components/dream/icon-paths";
import { CaptionImageEditorModal, type CaptionImageDraft, type CaptionImageInitial } from "@/components/dream/caption-image-editor-modal";

const CURRENT_TOOL_ID = "transit";

// 使用者還沒存過任何一組時，先給幾組不同的假文案墊著，讓編輯彈窗一打開就看得出這個功能
// 最後會長什麼樣子（之後有真的素材了，使用者自己把每一組換掉）。
const WEEKEND_TRIP_DEFAULT_CAPTIONS = [
  "收藏屬於你的風景 ♡",
  "給自己一個小旅行的理由",
  "出發，遇見不一樣的風景",
  "慢下來，享受這個週末",
  "探索城市裡的小驚喜",
  "帶著好心情，隨時出發",
  "週末限定，屬於你的旅程",
];

function defaultWeekendTripDrafts(): CaptionImageDraft[] {
  return WEEKEND_TRIP_DEFAULT_CAPTIONS.map((caption) => ({ title: "週末小旅行", caption, image: ICON_PATHS.weekendTripBanner }));
}

// 首頁最上方文案目前先給 2 組測試用的墊檔。
function defaultHeroBannerDrafts(): CaptionImageDraft[] {
  return [
    { title: "下一站，去看更大的世界", caption: "一段旅程，都是生活的延伸", image: ICON_PATHS.heroMain },
    { title: "帶上行李，說走就走", caption: "每一次出發，都值得期待", image: ICON_PATHS.heroMain },
  ];
}

export function MoreView() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  // 「其他小工具」只列使用者真的有權限、而且不是目前這個工具（搭乘車查詢）的項目。
  const otherTools = TOOLS_REGISTRY.filter((t) => t.toolId !== CURRENT_TOOL_ID && (user?.tools ?? []).includes(t.toolId));

  // 首頁「週末小旅行」每次進頁面隨機顯示的那幾組文案＋背景圖，在這頁統一編輯。
  const [weekendTrips, setWeekendTrips] = useState<CaptionImageInitial[]>([]);
  const [weekendEditorOpen, setWeekendEditorOpen] = useState(false);

  // 首頁最上方（大張插畫 Banner）每次進頁面隨機顯示的文案＋背景圖，邏輯跟週末小旅行一樣。
  const [heroBanners, setHeroBanners] = useState<CaptionImageInitial[]>([]);
  const [heroEditorOpen, setHeroEditorOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/transit/weekend-trips")
      .then((res) => res.json())
      .then((data: { items?: CaptionImageInitial[] }) => {
        if (!cancelled) setWeekendTrips(data.items ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/transit/hero-banners")
      .then((res) => res.json())
      .then((data: { items?: CaptionImageInitial[] }) => {
        if (!cancelled) setHeroBanners(data.items ?? []);
      })
      .catch(() => {});
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
      .then((data: { items?: CaptionImageInitial[] }) => setWeekendTrips(data.items ?? []))
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
      .then((data: { items?: CaptionImageInitial[] }) => setHeroBanners(data.items ?? []))
      .catch(() => {});
    setHeroEditorOpen(false);
  }

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <div className="flex flex-col px-5 pb-6 pt-6">
      <h1 className="text-xl font-bold text-[#4A3B7C]">其他</h1>

      <div className="mt-5 flex flex-col gap-5">
        <div>
          <p className="mb-2 px-1 text-xs font-medium text-[#9C94C4]">其他小工具</p>
          <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl bg-white shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)]">
            {loading ? (
              <p className="px-4 py-3 text-sm text-[#B3ABD4]">載入中…</p>
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

        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs font-medium text-[#9C94C4]">首頁上方文案</p>
            <button type="button" onClick={() => setHeroEditorOpen(true)} aria-label="編輯首頁上方文案">
              <FaIcon icon="pen" size={12} />
            </button>
          </div>
          <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl bg-white shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)]">
            {heroBanners.length === 0 ? (
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
            <p className="text-xs font-medium text-[#9C94C4]">週末小旅行</p>
            <button type="button" onClick={() => setWeekendEditorOpen(true)} aria-label="編輯週末小旅行">
              <FaIcon icon="pen" size={12} />
            </button>
          </div>
          <div className="flex flex-col divide-y divide-[#F2EEFA] overflow-hidden rounded-2xl bg-white shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)]">
            {weekendTrips.length === 0 ? (
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
        heading="編輯首頁上方文案"
        description="首頁最上方的大張插畫 Banner，每次進頁面／重新整理會從下面這幾組裡隨機挑一組顯示標題、文案跟背景圖。"
        itemLabel="組"
        defaultImage={ICON_PATHS.heroMain}
        defaultDrafts={defaultHeroBannerDrafts}
        initial={heroBanners}
        onClose={() => setHeroEditorOpen(false)}
        onSave={saveHeroBanners}
      />

      <CaptionImageEditorModal
        key={weekendEditorOpen ? "weekend-open" : "weekend-closed"}
        open={weekendEditorOpen}
        heading="編輯週末小旅行"
        description="首頁「週末小旅行」每次進頁面／重新整理會從下面這幾組裡隨機挑一組顯示標題、文案跟背景圖。"
        itemLabel="組"
        defaultImage={ICON_PATHS.weekendTripBanner}
        defaultDrafts={defaultWeekendTripDrafts}
        initial={weekendTrips}
        onClose={() => setWeekendEditorOpen(false)}
        onSave={saveWeekendTrips}
      />
    </div>
  );
}
