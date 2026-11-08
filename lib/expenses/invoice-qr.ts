/** 台灣統一發票（電子發票證明聯）上那兩個 QR code 的解析——純函式，不碰網路也不碰 DOM。
 *
 *  **為什麼走 QR 不走 OCR**：發票的 QR 裡本來就是結構化資料（財政部規定的格式），金額
 *  跟日期是「讀出來的」不是「認出來的」。拍歪、反光、熱感應紙褪色都不影響，也不用把圖
 *  送去任何模型，零費用。OCR 在繁體中文熱感應紙上的辨識率不足以拿來記帳——認錯一個
 *  數字就是一筆錯帳。
 *
 *  ── 左邊 QR 的格式（前 77 碼固定寬度，後面用 `:` 分欄）────────────────────────
 *    0-9    10 碼  發票字軌號碼（2 英文字母 + 8 數字）
 *    10-16   7 碼  開立日期，民國年 YYYMMDD
 *    17-20   4 碼  隨機碼
 *    21-28   8 碼  銷售額（未稅），十六進位
 *    29-36   8 碼  總計額（含稅），十六進位
 *    37-44   8 碼  買方統一編號（沒有就是 00000000）
 *    45-52   8 碼  賣方統一編號
 *    53-76  24 碼  加密驗證資訊
 *    77 之後        :營業人自訂區:本條碼品目筆數:發票總品目筆數:中文編碼:品名:數量:單價:…
 *
 *  ── 右邊 QR ──────────────────────────────────────────────────────────────
 *  以 `**` 開頭，接續左邊放不下的品目。只有左邊也能用（金額、日期都在左邊），右邊是
 *  用來補齊品名的。 */

/** 中文編碼參數：0 = Big5、1 = UTF-8、2 = Base64。 */
const ENCODING_BIG5 = "0";
const ENCODING_BASE64 = "2";

const FIXED_LENGTH = 77;

export interface InvoiceQrItem {
  name: string;
  qty: number;
  unitPrice: number;
}

export interface InvoiceQrResult {
  /** 發票字軌號碼，例如 AB12345678。 */
  invoiceNumber: string;
  /** 開立日期，已經換算成西元的 YYYY-MM-DD。 */
  date: string;
  /** 總計額（含稅）——記帳要記的就是這個數字。 */
  totalAmount: number;
  /** 銷售額（未稅）。目前沒用到，但解都解了就一起回傳。 */
  salesAmount: number;
  /** 買方統編，沒有統編的消費發票是 undefined（原始資料是 00000000）。 */
  buyerTaxId?: string;
  sellerTaxId: string;
  /** 品名明細。店家沒把明細編進 QR（或用 Big5 編碼）時是空陣列——那時候只剩總金額可用。 */
  items: InvoiceQrItem[];
}

/** 民國 YYYMMDD → 西元 YYYY-MM-DD。格式不對回 null。 */
function toIsoDate(roc: string): string | null {
  if (!/^\d{7}$/.test(roc)) return null;
  const year = Number(roc.slice(0, 3)) + 1911;
  const month = roc.slice(3, 5);
  const day = roc.slice(5, 7);
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return null;
  return `${year}-${month}-${day}`;
}

/** 8 碼十六進位 → 數字。發票上的金額都是整數（台灣的發票不會有小數）。 */
function hexAmount(hex: string): number | null {
  if (!/^[0-9A-Fa-f]{1,8}$/.test(hex)) return null;
  const value = parseInt(hex, 16);
  return Number.isFinite(value) ? value : null;
}

/** Base64 編碼的品名解回文字。解不開就回原字串——寧可顯示一串看不懂的字讓使用者自己改，
 *  也不要整張發票因為一個品名就解析失敗。 */
function decodeName(raw: string, encoding: string): string {
  if (encoding !== ENCODING_BASE64) return raw;
  try {
    const binary = atob(raw);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return raw;
  }
}

/**
 * 解析發票 QR。`left` 是左邊那個 code 的內容，`right` 是右邊那個（可以不給）。
 *
 * 解不出「發票號碼 + 日期 + 總金額」這三個必要欄位就回 null——那代表掃到的不是統一發票
 * （可能是其他 QR、或是糊掉只解出半截），這時候要讓使用者知道掃失敗，而不是記一筆
 * 金額是 0 的帳。
 */
export function parseInvoiceQr(left: string, right?: string): InvoiceQrResult | null {
  const payload = left.trim();
  if (payload.length < FIXED_LENGTH) return null;

  const invoiceNumber = payload.slice(0, 10).toUpperCase();
  if (!/^[A-Z]{2}\d{8}$/.test(invoiceNumber)) return null;

  const date = toIsoDate(payload.slice(10, 17));
  if (!date) return null;

  const salesAmount = hexAmount(payload.slice(21, 29));
  const totalAmount = hexAmount(payload.slice(29, 37));
  if (salesAmount === null || totalAmount === null || totalAmount <= 0) return null;

  const buyerTaxId = payload.slice(37, 45);
  const sellerTaxId = payload.slice(45, 53);

  // 77 碼之後才是 `:` 分欄的部分。前四欄是固定的（自訂區、本條碼品目數、總品目數、編碼），
  // 第五欄開始每三個一組是「品名:數量:單價」。
  const tail = payload.slice(FIXED_LENGTH).replace(/^:/, "");
  const fields = tail ? tail.split(":") : [];
  const encoding = fields[3] ?? "";
  // 右邊那個 code 開頭的 `**` 是分隔記號，不是資料。
  const rightFields = right ? right.trim().replace(/^\*\*/, "").replace(/^:/, "").split(":") : [];
  const itemFields = [...fields.slice(4), ...rightFields].filter((f) => f !== "");

  const items: InvoiceQrItem[] = [];
  // Big5 的品名在這裡已經是一串解錯的字了（QR 解碼時就當成 UTF-8 讀了），救不回來，
  // 乾脆不要放進明細——使用者看到亂碼只會更困惑，總金額還是正確的。
  if (encoding !== ENCODING_BIG5) {
    for (let i = 0; i + 2 < itemFields.length + 1; i += 3) {
      const name = decodeName(itemFields[i] ?? "", encoding).trim();
      const qty = Number(itemFields[i + 1]);
      const unitPrice = Number(itemFields[i + 2]);
      if (!name || !Number.isFinite(qty) || !Number.isFinite(unitPrice)) continue;
      items.push({ name, qty, unitPrice });
    }
  }

  return {
    invoiceNumber,
    date,
    totalAmount,
    salesAmount,
    // 00000000 是「這張發票沒有買方統編」的意思，不是一個統編。
    buyerTaxId: /^0{8}$/.test(buyerTaxId) ? undefined : buyerTaxId,
    sellerTaxId,
    items,
  };
}
