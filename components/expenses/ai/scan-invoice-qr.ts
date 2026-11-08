"use client";

import jsQR from "jsqr";
import { parseInvoiceQr, type InvoiceQrResult } from "@/lib/expenses/invoice-qr";

/** 從一張發票照片裡把兩個 QR code 解出來，再交給 parseInvoiceQr 轉成結構化資料。
 *
 *  **兩條解碼路徑**：優先用瀏覽器內建的 BarcodeDetector（Chrome／Edge／Android Chrome
 *  有，速度快、一次就能回傳畫面上所有的 code）；沒有的瀏覽器（iOS Safari）退回 jsQR。
 *  兩條都在瀏覽器裡跑完，圖片不會離開這台裝置，也沒有任何 API 費用。
 *
 *  **為什麼 jsQR 要掃好幾輪**：它一次只回傳找到的第一個 QR，但發票上並排著兩個。做法是
 *  掃到一個之後，把它在畫布上的位置塗白，再掃一次——比「切左半邊／右半邊」可靠，因為
 *  照片很少拍得正，發票一歪，兩個 code 就不會乖乖各待在自己那半邊。 */

/** 手機拍的照片動輒四千多像素寬，整張丟進 jsQR 會慢到像當掉。縮到長邊 1800 px——
 *  發票上的 QR 在這個尺寸下還有足夠的模組解析度。 */
const MAX_EDGE = 1800;

/** BarcodeDetector 還不在 TypeScript 的標準 DOM 定義裡，用到的部分自己宣告。 */
interface DetectedBarcodeLike {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: ImageBitmap | HTMLCanvasElement): Promise<DetectedBarcodeLike[]>;
}
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function getBarcodeDetector(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor };
  return w.BarcodeDetector ?? null;
}

async function toCanvas(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

/** 發票最多兩個 code，掃三輪是留一點餘裕（有些版面會多印一個載具條碼）。 */
const MAX_PASSES = 3;

/** 用 jsQR 把畫布上的 QR 一個一個挖出來：掃到一個就把它的位置塗白，再掃下一輪，
 *  直到掃不到為止。 */
function scanWithJsQr(canvas: HTMLCanvasElement): string[] {
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];

  const found: string[] = [];
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(image.data, image.width, image.height);
    if (!code?.data) break;
    found.push(code.data);

    // 把剛剛那個 code 蓋掉，下一輪才不會又掃到同一個。四個角取外接矩形、往外多留幾
    // 像素，避免定位點的殘邊又被認成一個 code。
    const xs = [code.location.topLeftCorner.x, code.location.topRightCorner.x, code.location.bottomLeftCorner.x, code.location.bottomRightCorner.x];
    const ys = [code.location.topLeftCorner.y, code.location.topRightCorner.y, code.location.bottomLeftCorner.y, code.location.bottomRightCorner.y];
    const pad = 4;
    ctx.fillStyle = "#fff";
    ctx.fillRect(Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + pad * 2, Math.max(...ys) - Math.min(...ys) + pad * 2);
  }
  return found;
}

async function decodeAll(file: File): Promise<string[]> {
  const canvas = await toCanvas(file);

  const Detector = getBarcodeDetector();
  if (Detector) {
    try {
      const codes = await new Detector({ formats: ["qr_code"] }).detect(canvas);
      const values = codes.map((c) => c.rawValue).filter(Boolean);
      if (values.length > 0) return values;
    } catch {
      // BarcodeDetector 有時候會在某些格式／某些裝置上直接丟錯，掉到 jsQR 再試一次。
    }
  }

  return [...new Set(scanWithJsQr(canvas))];
}

/** 掃一張發票照片。回 null 代表這張圖裡找不到看得懂的統一發票 QR。 */
export async function scanInvoiceQr(file: File): Promise<InvoiceQrResult | null> {
  const values = await decodeAll(file);
  if (values.length === 0) return null;

  // 左碼是固定 77 碼起跳、開頭「兩個英文字母＋八位數字」的那一個；右碼以 ** 開頭。
  const left = values.find((v) => /^[A-Z]{2}\d{8}/i.test(v.trim()) && v.trim().length >= 77);
  const right = values.find((v) => v.trim().startsWith("**"));
  if (!left) return null;

  return parseInvoiceQr(left, right);
}
