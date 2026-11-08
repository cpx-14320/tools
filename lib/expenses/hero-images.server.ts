import fs from "fs";
import path from "path";

/** 首頁主視覺要隨機挑哪一張——直接掃 public/expenses 底下的 `main-kv-*.png`，不是寫死
 *  一份檔名清單。這樣之後多畫幾張、或拿掉其中一張，只要把檔案丟進去／刪掉就生效，
 *  不用回來改程式。
 *
 *  掃目錄這件事必須在伺服器端做（瀏覽器讀不到檔案系統），而且 Vercel 的 serverless
 *  function 預設不會把 public/ 打包進去（那些檔案是交給 CDN 送的），所以 next.config
 *  用 outputFileTracingIncludes 把這個資料夾一起帶進去——少了那一行，正式站上這裡會
 *  讀到空陣列。 */
const HERO_DIR = path.join(process.cwd(), "public", "expenses");
const HERO_PREFIX = "main-kv-";

/** 掃不到任何圖時的退路。回空字串讓呼叫端自己決定要不要畫 <img>——硬指一個不存在的
 *  檔名只會變成破圖。 */
export function heroImages(): string[] {
  try {
    return fs
      .readdirSync(HERO_DIR)
      .filter((f) => f.startsWith(HERO_PREFIX) && /\.(png|jpg|jpeg|webp)$/i.test(f))
      .sort()
      .map((f) => `/expenses/${f}`);
  } catch {
    return [];
  }
}

/** 隨機挑一張。在 Server Component 裡呼叫，所以每次進首頁（這一頁是 force-dynamic）
 *  都會重新挑一次。 */
export function randomHeroImage(): string {
  const images = heroImages();
  return images.length > 0 ? images[Math.floor(Math.random() * images.length)] : "";
}
