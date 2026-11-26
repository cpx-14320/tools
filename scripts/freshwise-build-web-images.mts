/**
 * 從素材庫的母圖產生 public/freshwise 的網頁用圖（縮放 ＋ 轉 WebP）。
 *
 * ## 為什麼有這支腳本
 *
 * 母圖與網頁用圖是兩件不同的東西，放在兩個地方：
 *
 * | | 位置 | 規則 |
 * | --- | --- | --- |
 * | 母圖 | `小工具素材/圖片未壓縮/freshwise/` | 不因網頁需求縮放、轉格式、改名 |
 * | 網頁用圖 | `cpx-tools/public/freshwise/` | 可以縮放、壓縮、改副檔名，壞了重跑這支就好 |
 *
 * **一律從母圖出發**，不是拿網頁現有的圖再壓一次——後者每跑一次就多一層壓縮損失。
 * 所以這支腳本是可以重複執行的：同一份母圖永遠產出同一份網頁用圖。
 *
 * ## 尺寸是怎麼決定的
 *
 * 畫面是 430px 寬的手機框（`.fw-phone` 的 max-width），所以沒有任何素材需要超過
 * 430 × 3 ＝ 1290px。每一組的目標尺寸是「這個素材在畫面上最大顯示幾 px × 3」，
 * 寫在下面的 RULES 裡，每一條都附了理由。改版面尺寸時要回來對一次。
 *
 * ## 用法
 *
 *   npx tsx scripts/freshwise-build-web-images.mts          # 重建全部
 *   npx tsx scripts/freshwise-build-web-images.mts --dry    # 只看計畫（不編碼不寫檔，幾秒跑完）
 *   npx tsx scripts/freshwise-build-web-images.mts pet-     # 只重建檔名以 pet- 開頭的
 *
 * 跑完會印出每一組的前後大小，並把明細寫到 scripts/.freshwise-web-images.txt。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import sharp from "sharp";

const MASTERS = "D:/coding-project/小工具素材/圖片未壓縮/freshwise";
const WEB = resolve(process.cwd(), "public/freshwise");
const REPORT = resolve(process.cwd(), "scripts/.freshwise-web-images.txt");
const IMAGE = /\.(png|webp|jpg|jpeg)$/i;

interface Rule {
  /** 只給 width 或只給 height 就等比縮放；null＝不縮放，只轉檔。 */
  size: { width?: number; height?: number } | null;
  quality: number;
  why: string;
}

/** 第一條命中的規則生效，所以**順序有意義**（`ui-paper-texture` 要排在 `ui-` 前面）。 */
const RULES: [RegExp, Rule][] = [
  [/^pet-/, { size: { width: 640, height: 640 }, quality: 86, why: "夥伴最大顯示 200px（首頁），640 ≈ 3 倍" }],
  [/^ui-paper-texture$/, { size: { width: 512 }, quality: 80, why: "平鋪紙紋，實際以 128～160px 重複" }],
  [/^ui-/, { size: { width: 192 }, quality: 82, why: "介面圖示最大顯示 48px（分類貨架）" }],
  [/^(item-|dish-)/, { size: null, quality: 82, why: "256px 已經夠用（最大顯示 80px），只轉檔不縮放" }],
  [/^garden-day-background$/, { size: { width: 1290 }, quality: 80, why: "cover 鋪滿手機框寬 430px，1290 ＝ 3 倍" }],
  [/^collection-companion-atlas$/, { size: { width: 900 }, quality: 84, why: "3×2 圖鑑圖集，每格顯示 76px（整張約 276px）" }],
  [/^home-price-tag-board-clean$/, { size: { width: 540 }, quality: 84, why: "首頁價牌 max-width 174px" }],
  [/^page-market-awning-background$/, { size: { width: 1290 }, quality: 82, why: "寬度跟著手機框 430px" }],
  [/^market-wood-counter-low$/, { size: { width: 1290 }, quality: 82, why: "寬度跟著手機框 430px" }],
  [/^market-small-price-card$/, { size: { width: 270 }, quality: 84, why: "首頁小價卡顯示 88px 寬" }],
  [/^companion-growth-frame-/, { size: { height: 120 }, quality: 84, why: "切片用 background-size:auto 100%，看高度；顯示高約 35px" }],
  [/^companion-level-ribbon-/, { size: { height: 120 }, quality: 84, why: "同上，等級徽帶顯示高約 33px" }],
  [/^home-market-wood-counter-board-web/, { size: null, quality: 84, why: "image-set 的 1x/2x/3x 階梯，尺寸要保留" }],
];

/**
 * 原檔照搬、不重新編碼的素材。
 *
 * - `home-quest-paper`：CSS 的 `border-image ... 240 180 228 300` 切片數值是**原始像素**，
 *   縮圖就得同步改那四個數字，框線會跑掉。
 * - `page-hanging-title-*`：已經是 30KB 的輕量 WebP，重壓只是多一次失真。
 */
const KEEP_AS_IS = [/^home-quest-paper$/, /^page-hanging-title-/];

const args = process.argv.slice(2);
const dryRun = args.includes("--dry");
const filter = args.find((a) => !a.startsWith("--"));

function ruleFor(stem: string): Rule | "keep" {
  if (KEEP_AS_IS.some((r) => r.test(stem))) return "keep";
  const hit = RULES.find(([r]) => r.test(stem));
  if (!hit) throw new Error(`沒有對應規則的素材：${stem}（請在 RULES 補一條，並寫下尺寸的理由）`);
  return hit[1];
}

async function main() {
  if (!existsSync(MASTERS)) throw new Error(`找不到母圖資料夾：${MASTERS}`);
  mkdirSync(WEB, { recursive: true });

  const masters = readdirSync(MASTERS)
    .filter((f) => IMAGE.test(f) && (!filter || f.startsWith(filter)))
    .sort();

  const lines: string[] = [];
  let before = 0;
  let after = 0;

  for (const master of masters) {
    const stem = basename(master).replace(IMAGE, "");
    const rule = ruleFor(stem);
    const src = join(MASTERS, master);
    const srcMeta = await sharp(src).metadata();
    const out = join(WEB, stem + (rule === "keep" ? extname(master).toLowerCase() : ".webp"));

    // 舊的網頁檔可能是 .png 也可能是 .webp（轉檔過程中兩種都會遇到），一起算進「之前」
    // 並在寫入新檔之後刪掉，避免留下同名不同副檔名的兩份。
    const olds = [".png", ".webp"].map((e) => join(WEB, stem + e)).filter((p) => existsSync(p));
    before += olds.reduce((sum, p) => sum + statSync(p).size, 0);

    // --dry 刻意**不編碼**：595 張重壓一次要十幾分鐘，而「會做什麼」看規則就知道了。
    // 所以乾跑印的是計畫（來源尺寸、要縮到多少、品質），不是結果大小。
    if (dryRun) {
      const plan = rule === "keep" ? "維持原檔" : rule.size ? `縮到 ${JSON.stringify(rule.size)}、webp q${rule.quality}` : `只轉 webp q${rule.quality}`;
      lines.push([basename(out), `${srcMeta.width}x${srcMeta.height} ${srcMeta.format}`, "→", plan, rule === "keep" ? "維持原檔" : rule.why].join("\t"));
      continue;
    }

    const buf =
      rule === "keep"
        ? readFileSync(src)
        : await (rule.size
            ? sharp(src).resize({ ...rule.size, fit: "inside", withoutEnlargement: true, kernel: "lanczos3" })
            : sharp(src)
          )
            .webp({ quality: rule.quality, alphaQuality: 100, effort: 6 })
            .toBuffer();
    after += buf.length;

    writeFileSync(out, buf);
    for (const p of olds) if (resolve(p) !== resolve(out)) unlinkSync(p);

    const outMeta = await sharp(out).metadata();
    lines.push(
      [
        basename(out),
        `${srcMeta.width}x${srcMeta.height} ${srcMeta.format}`,
        "→",
        `${outMeta.width}x${outMeta.height} ${rule === "keep" ? "原檔" : `webp q${rule.quality}`}`,
        `${Math.round(buf.length / 1024)}KB`,
        rule === "keep" ? "維持原檔" : rule.why,
      ].join("\t"),
    );
  }

  const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
  const head = [
    `${dryRun ? "[--dry 只看計畫，沒有編碼也沒有寫檔] " : ""}母圖 ${MASTERS}`,
    `網頁 ${WEB}`,
    dryRun ? `會處理 ${masters.length} 檔` : `處理 ${masters.length} 檔：${mb(before)}MB → ${mb(after)}MB（省 ${mb(before - after)}MB）`,
  ];
  writeFileSync(REPORT, [...head, "", ...lines].join("\n"), "utf8");
  console.log(head.join("\n"));
  console.log(`明細：${REPORT}`);
}

await main();
