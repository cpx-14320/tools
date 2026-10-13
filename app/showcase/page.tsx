import type { Metadata } from "next";
import { ShowcaseView } from "./showcase-view";

export const metadata: Metadata = {
  title: "搭車咻一下 · 技術作品介紹",
  description: "個人開發的交通查詢與記帳整合平台——技術棧、頁面功能與架構決策的完整說明。",
};

// 這頁刻意不包在 HubShell／登入驗證裡——它是給其他人看的技術作品介紹，不是工具本身，
// 不應該要求訪客先登入才看得到內容。
export default function ShowcasePage() {
  return <ShowcaseView />;
}
