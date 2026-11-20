import { freshwisePageData } from "@/lib/freshwise/page-data.server";
import { HomeView } from "./home-view";

/**
 * 首頁。
 *
 * 這一層（Server Component）負責三件事：讀使用者偏好（cookie）、算出「今天」（台灣時
 * 區）、把今天的行情從 MongoDB 取回來（必要時先去農業部與臺中市的開放資料更新）。
 * 價格一律在伺服器端算完再傳 props 下去，client 不自己抓資料——跟記帳本同一套做法。
 *
 * force-dynamic：行情每天會變、而且要讀 cookie 決定看哪個場所，不能被靜態化。
 */
export const dynamic = "force-dynamic";

export default async function FreshwiseHomePage() {
  const { today, book } = await freshwisePageData();
  return <HomeView today={today} book={book} />;
}
