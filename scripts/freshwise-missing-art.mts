/** 列出「目錄裡有、但還沒有插畫」的品項與它們應該放的檔案路徑。
 *
 *  用法：npx tsx scripts/freshwise-missing-art.mts
 *  圖檔放進 public/freshwise/ 之後不用改程式，item-icon.tsx 會自動開始用。
 */
const { CATALOG, TRACKED_CATALOG } = (await import("../lib/freshwise/catalog")) as unknown as {
  CATALOG: { code: string; name: string; category: string }[];
  TRACKED_CATALOG: { code: string }[];
};
import { existsSync } from "node:fs";


// 看磁碟上有沒有那張圖——註冊表只說「這個代碼叫什麼檔名」，不代表檔案存在。
const haveArt = new Set(CATALOG.filter((i) => existsSync(`public/freshwise/item-${i.code}.png`)).map((i) => i.code));
const tracked = new Set(TRACKED_CATALOG.map((i) => i.code));
const missing = CATALOG.filter((i) => !haveArt.has(i.code));

console.log(`目錄 ${CATALOG.length} 項，已有插畫 ${haveArt.size} 項，待補 ${missing.length} 項。`);
console.log("");
console.log("有行情資料的（會出現在畫面上，優先補）：");
for (const i of missing.filter((x) => tracked.has(x.code))) {
  console.log(`  public/freshwise/item-${i.code}.png   ${i.name}（${i.category}）`);
}
const rest = missing.filter((x) => !tracked.has(x.code));
if (rest.length > 0) {
  console.log("");
  console.log("目前沒有行情來源的（畫面上不會出現，可以晚點再補）：");
  for (const i of rest) console.log(`  public/freshwise/item-${i.code}.png   ${i.name}（${i.category}）`);
}
