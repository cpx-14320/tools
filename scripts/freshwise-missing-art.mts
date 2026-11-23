/** 列出「目錄裡有、但還沒有插畫」的品項與它們應該放的檔案路徑。
 *
 *  用法：npx tsx scripts/freshwise-missing-art.mts
 *  圖檔放進 public/freshwise/ 之後不用改程式，item-icon.tsx 會自動開始用。
 */
const { CATALOG, TRACKED_CATALOG } = (await import("../lib/freshwise/catalog")) as unknown as {
  CATALOG: { code: string; name: string; category: string }[];
  TRACKED_CATALOG: { code: string }[];
};
const { itemArtwork } = (await import("../lib/freshwise/art-assets")) as unknown as {
  itemArtwork: (code: string) => { file: string } | undefined;
};
import { existsSync } from "node:fs";


// 走 itemArtwork 再看磁碟——有些品項的圖不是叫 item-<code>.png（2026-11 那批是照農業部
// 的作物代號出圖的，對照表在 art-assets.ts）。只比對檔名會把那些誤報成缺圖。
const haveArt = new Set(
  CATALOG.filter((i) => {
    const art = itemArtwork(i.code);
    return !!art && existsSync(`public${art.file}`);
  }).map((i) => i.code),
);
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
