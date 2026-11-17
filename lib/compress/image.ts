// 圖片壓縮的核心——**整段都在瀏覽器裡跑，圖片不會上傳到任何伺服器**。
//
// 這個決定不只是為了省主機頻寬：使用者丟進來的常常是截圖、證件、小孩的照片，「這張圖
// 有沒有離開我的手機」是他會想知道的事。瀏覽器原生就有解碼器（createImageBitmap）跟
// 編碼器（canvas → WebP／JPEG／PNG），一張 4000px 的照片在手機上大約幾百毫秒，沒有
// 理由為了壓縮把檔案傳出去。所以這支檔案沒有 "use server"、也沒有對應的 API route。
//
// 能做到什麼程度要先講清楚：這裡做的是「重新編碼」（必要時先縮尺寸），不是 TinyPNG 那種
// PNG 調色盤量化（pngquant）。所以
//   - 照片（JPEG）、半透明的 UI 截圖（PNG → WebP）壓下來很有感，通常 50%～85%；
//   - 真的要留 PNG 的圖只能靠縮尺寸，瀏覽器的 PNG 編碼器沒有品質參數可調。
// 這也是「自動」模式一律把非 JPEG 的圖轉成 WebP 的原因：同畫質下它比 PNG 小得多，而且
// 保有透明通道。

/** 輸出格式的選項。`keep` 是「保留原格式」，`auto` 是推薦值（見 targetMime）。 */
export type OutputFormat = "auto" | "webp" | "jpeg" | "png" | "keep";

/** 這個格式吃不吃「品質」這個參數。PNG 是無損的，瀏覽器的 PNG 編碼器沒有品質可調——
 *  選了 PNG 還讓品質滑桿能動的話，拉半天檔案大小一個 byte 都不會變。 */
export function usesQuality(format: OutputFormat): boolean {
  return format !== "png";
}

export interface CompressOptions {
  format: OutputFormat;
  /** 0～1 的有損品質，PNG 用不到（瀏覽器的 PNG 編碼器吃不到這個參數）。 */
  quality: number;
  /** 長邊上限（px），null ＝ 不縮。 */
  maxEdge: number | null;
}

export interface CompressOutput {
  blob: Blob;
  mime: string;
  /** 建議的下載檔名：原檔名換成實際輸出格式的副檔名。 */
  filename: string;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  /** 壓完比原檔還大，所以原封不動回傳原檔（blob 就是那個 File 本身）。 */
  usedOriginal: boolean;
  /** 原圖有透明，但輸出成不支援透明的 JPEG，透明的地方被填成白色。 */
  flattened: boolean;
  /** 原檔是動圖（GIF），只有第一格被留下來。 */
  firstFrameOnly: boolean;
}

/** 瀏覽器的 canvas 真的能「編碼出來」的格式。輸出只會是這三種之一。 */
const ENCODABLE = new Set(["image/png", "image/jpeg", "image/webp"]);

/** 可以丟進來的格式。SVG 刻意不收：它是向量，重新編碼成點陣圖只會變大又變模糊，
 *  而且各家瀏覽器對 createImageBitmap 吃 SVG 的支援不一致。 */
export const ACCEPTED_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp", "image/avif"] as const;

/** `<input accept>` 用的字串。同時寫 MIME 跟副檔名：有些 Android 的檔案選擇器只認副檔名。 */
export const ACCEPT_ATTR = [...ACCEPTED_MIMES, ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".avif"].join(",");

// 張數與單張大小都刻意**沒有**上限。
//
// 張數：壓縮是一張壓完才壓下一張（見 compress-view 的 processPending），同一時間只有
// 一張圖被解開成點陣資料；排隊中的項目只佔一個 File 參考，內容還在磁碟上。
//
// 單張大小：擋不擋得住跟檔案大小沒什麼關係——真正吃記憶體的是解碼後的像素量
// （寬 × 高 × 4 bytes），而一張 3MB 的 PNG 可能比 20MB 的 JPEG 還大張。與其用一個猜的
// 數字先拒絕使用者，不如讓它真的去壓：壓得動就壓，解不開會拋錯、壓太久會逾時，兩種
// 情況都有看得懂的錯誤訊息（見 processPending 的 catch），而且只有那一張受影響。

export function isAcceptedFile(file: File): boolean {
  // type 空字串是常態（某些來源的檔案沒有 MIME），這時退回看副檔名。
  if (file.type) return (ACCEPTED_MIMES as readonly string[]).includes(file.type);
  return /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.name);
}

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** 檔案大小寫成人看的單位。`1023 B`／`87.4 KB`／`2.13 MB`——KB 以上留小數，不然從
 *  「1.2 MB」壓到「980 KB」會變成「1 MB → 1 MB」，看不出有壓到。 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

/** 省下幾 %（四捨五入到整數，負數代表變大了）。 */
export function savedPercent(originalBytes: number, nextBytes: number): number {
  if (originalBytes <= 0) return 0;
  return Math.round(((originalBytes - nextBytes) / originalBytes) * 100);
}

/** 決定要輸出成什麼格式。
 *
 *  `auto`：JPEG 留 JPEG（照片轉 WebP 的額外收益不大，但換副檔名會讓人意外），其他一律
 *  轉 WebP——PNG／GIF／BMP 轉過去通常小一個級距，而且透明通道還在。
 *
 *  `png`：無損，而且是唯一「一定留得住透明」的選項。但照片轉 PNG 幾乎一定比原檔大
 *  （無損編碼存不下照片那種連續色調），所以它是給截圖、純色圖、要再進修圖軟體的圖用的，
 *  不是拿來讓檔案變小的——這一點在介面上要寫清楚，不要讓人選了才發現變大。
 *
 *  `keep`：原格式不是 canvas 編得出來的（GIF／BMP／AVIF）時沒辦法真的「保留」，有透明
 *  就退 PNG、沒透明就退 JPEG。 */
export function targetMime(sourceMime: string, format: OutputFormat, hasAlpha: boolean): string {
  if (format === "webp") return "image/webp";
  if (format === "jpeg") return "image/jpeg";
  if (format === "png") return "image/png";
  if (format === "keep") return ENCODABLE.has(sourceMime) ? sourceMime : hasAlpha ? "image/png" : "image/jpeg";
  return sourceMime === "image/jpeg" ? "image/jpeg" : "image/webp";
}

/** 等比縮到長邊不超過 maxEdge；本來就夠小（或沒設上限）就原樣回傳。 */
export function fitWithin(width: number, height: number, maxEdge: number | null): { width: number; height: number } {
  if (!maxEdge || Math.max(width, height) <= maxEdge) return { width, height };
  const scale = maxEdge / Math.max(width, height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;

function makeCanvas(width: number, height: number): AnyCanvas {
  // OffscreenCanvas 的 convertToBlob 編碼不佔主執行緒，手機上連續壓十幾張時介面不會卡住；
  // 沒有的瀏覽器（舊 Safari）退回一般 <canvas>，功能一樣只是會卡一下。
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** 取 2D 繪圖環境。兩種 canvas 的 context 型別不同但這裡用到的那幾個成員（fillRect、
 *  drawImage、getImageData、imageSmoothing*）簽名一模一樣，所以統一當 CanvasRenderingContext2D
 *  用——不這樣收斂的話，每個呼叫點都要處理「union 的兩個 signature 不相容」的型別錯誤。 */
function get2dContext(canvas: AnyCanvas, alpha: boolean): CanvasRenderingContext2D | null {
  const ctx = canvas instanceof HTMLCanvasElement ? canvas.getContext("2d", { alpha }) : canvas.getContext("2d", { alpha });
  return (ctx as CanvasRenderingContext2D | null) ?? null;
}

function canvasToBlob(canvas: AnyCanvas, mime: string, quality: number | undefined): Promise<Blob> {
  if (canvas instanceof HTMLCanvasElement) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("這個瀏覽器編不出這個格式"))), mime, quality);
    });
  }
  return canvas.convertToBlob({ type: mime, quality });
}

async function decode(file: File): Promise<ImageBitmap> {
  try {
    // from-image：相機拍的 JPEG 常常是「橫著存、靠 EXIF 標記轉正」，不帶這個參數的話
    // 畫到 canvas 上就會躺平——壓縮完的圖方向跟原檔不一樣是最難追的那種 bug。
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // 參數不支援（舊 Safari 會直接丟錯）時退一步，至少要能壓。
    return await createImageBitmap(file);
  }
}

/** 這張圖「有沒有可能」帶透明——只有可能有的格式才值得花一次 getImageData 去確認。 */
function mightHaveAlpha(mime: string): boolean {
  return mime !== "image/jpeg";
}

/** 真的有沒有透明像素。
 *
 *  刻意縮到長邊 160px 再掃：原尺寸 getImageData 要配置 寬×高×4 bytes（4000×3000 就是
 *  48MB）而且會逐像素掃一遍，只為了回答一個是非題。縮圖時 alpha 會被內插，所以「只有
 *  四個角是透明」這種圖縮完那幾格仍然不是 255，不會漏判。 */
async function detectAlpha(bitmap: ImageBitmap): Promise<boolean> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, 160);
  const canvas = makeCanvas(width, height);
  const ctx = get2dContext(canvas, true);
  if (!ctx) return false;
  ctx.drawImage(bitmap, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

/** 壓一張圖。丟進來的 File 不會被動到，回傳的是一顆新的 Blob（或壓不贏時的原檔本身）。 */
export async function compressImage(file: File, opts: CompressOptions): Promise<CompressOutput> {
  const bitmap = await decode(file);
  try {
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;
    const { width, height } = fitWithin(sourceWidth, sourceHeight, opts.maxEdge);
    const hasAlpha = mightHaveAlpha(file.type) ? await detectAlpha(bitmap) : false;
    const mime = targetMime(file.type, opts.format, hasAlpha);
    const flattened = hasAlpha && mime === "image/jpeg";

    const canvas = makeCanvas(width, height);
    // alpha: false 讓 JPEG 這種不支援透明的輸出不用先配置透明通道；要填白的那種也剛好
    // 是這一類。給 true 的話 Chrome 會把透明處壓成黑色，不是白色。
    const ctx = get2dContext(canvas, mime !== "image/jpeg");
    if (!ctx) throw new Error("瀏覽器沒給 canvas 繪圖環境");
    if (mime === "image/jpeg") {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);

    const encoded = await canvasToBlob(canvas, mime, mime === "image/png" ? undefined : opts.quality);
    // 瀏覽器編不出要求的格式時不會報錯，而是默默回一顆 PNG——以實際拿到的 type 為準，
    // 不然副檔名會跟內容不符（.webp 的檔案其實是 PNG）。
    const actualMime = ENCODABLE.has(encoded.type) ? encoded.type : mime;

    // 壓完比原檔大，而且格式、尺寸都沒變 → 原檔已經是更好的選擇，直接回原檔。
    // 常見於已經壓過的 JPEG、或是色塊很少的小 PNG（重新編碼只會把它變大）。
    const sameShape = width === sourceWidth && height === sourceHeight;
    if (encoded.size >= file.size && sameShape && actualMime === file.type) {
      return {
        blob: file,
        mime: file.type,
        filename: file.name,
        width,
        height,
        sourceWidth,
        sourceHeight,
        usedOriginal: true,
        flattened: false,
        firstFrameOnly: false,
      };
    }

    return {
      blob: encoded,
      mime: actualMime,
      filename: withExtension(file.name, EXT_BY_MIME[actualMime] ?? "img"),
      width,
      height,
      sourceWidth,
      sourceHeight,
      usedOriginal: false,
      flattened,
      firstFrameOnly: file.type === "image/gif",
    };
  } finally {
    // 解碼出來的 bitmap 佔的是 GPU／原生記憶體，不是 JS heap，GC 不會幫忙收——
    // 連續壓三十張不關的話分頁會被系統砍掉。
    bitmap.close();
  }
}

function withExtension(name: string, ext: string): string {
  const base = name.replace(/\.[^.]+$/, "") || "image";
  return `${base}.${ext}`;
}
