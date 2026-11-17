// 把幾個檔案包成一個 .zip。**不壓縮**（zip 的 "store" 模式），而且沒有用任何套件。
//
// 為什麼不壓縮：要打包的東西是這個工具剛壓好的 WebP／JPEG／PNG，本身已經是壓到底的
// 資料了。再 deflate 一次省不到幾個 byte（通常 0～1%），卻要把每一張重新跑一遍壓縮
// 演算法——幾十張大圖就是白白多等好幾秒。
//
// 為什麼不裝 JSZip：不壓縮的 zip 說穿了就是「檔頭 + 原始位元組 + 目錄表」，唯一需要
// 自己算的只有 CRC-32。整件事就是這個檔案的長度，為它多一個 100KB 的前端相依不划算。
//
// 沒有做 ZIP64，所以有三個硬上限（都在 buildZip 裡擋下來，呼叫端收到錯誤就退回逐張
// 下載）：檔案數 65535、單檔 4GB、總長度 4GB。

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** zip 存的是 1980 年起算的 DOS 日期時間（秒只有 2 秒的解析度，所以要除以 2）。 */
function dosDateTime(date: Date): { time: number; date: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/** 同名的檔案在 zip 裡會互相覆蓋（解壓縮時後面那個蓋掉前面那個），所以重名的要編號。
 *  這不是假想情況：從相機或下載資料夾一次選一批，常常好幾張都叫 image.png。 */
function uniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  for (let i = 2; ; i += 1) {
    const candidate = `${base} (${i})${ext}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
}

export class ZipTooLargeError extends Error {}

export interface ZipEntry {
  name: string;
  blob: Blob;
}

/** 打包。onProgress 每讀完一個檔案回報一次——幾百張的時候這件事本身就要好幾秒，
 *  畫面要能說「正在打包第幾個」。 */
export async function buildZip(entries: ZipEntry[], onProgress?: (done: number, total: number) => void): Promise<Blob> {
  if (entries.length > 0xffff) throw new ZipTooLargeError("檔案數超過 zip 的 65535 個上限");

  const { time, date } = dosDateTime(new Date());
  const encoder = new TextEncoder();
  const used = new Set<string>();

  // parts 裡放的是「檔頭（Uint8Array）」跟「原始的 Blob」交錯。刻意不把檔案內容複製成
  // Uint8Array 再收集起來——那等於把所有圖片在 JS heap 裡再放一份；交給 Blob 去串接，
  // 內容由瀏覽器自己管（大的 Blob 它會放到磁碟）。
  // 這兩個陣列最後要交給 Blob，而 BlobPart 只收 ArrayBuffer 背後的 view——不寫出
  // <ArrayBuffer> 的話會被推成 ArrayBufferLike（可能是 SharedArrayBuffer），型別對不上。
  const parts: BlobPart[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const nameBytes = encoder.encode(uniqueName(entry.name, used));
    const size = entry.blob.size;
    if (size > 0xffffffff) throw new ZipTooLargeError(`「${entry.name}」超過 zip 單檔 4GB 的上限`);

    // CRC 一定要讀過整個檔案才算得出來，所以這裡會把這一張暫時展開；算完就沒有人引用，
    // 下一圈就能被回收，峰值記憶體是「最大的那一張」而不是全部加總。
    const data = new Uint8Array(await entry.blob.arrayBuffer());
    const crc = crc32(data);

    const header = new Uint8Array(30 + nameBytes.length);
    const headerView = new DataView(header.buffer);
    headerView.setUint32(0, 0x04034b50, true); // local file header 簽章
    headerView.setUint16(4, 20, true); // 需要的版本：2.0
    headerView.setUint16(6, 0x0800, true); // bit 11：檔名是 UTF-8（中文檔名要靠這個）
    headerView.setUint16(8, 0, true); // 壓縮方法 0 ＝ store
    headerView.setUint16(10, time, true);
    headerView.setUint16(12, date, true);
    headerView.setUint32(14, crc, true);
    headerView.setUint32(18, size, true); // 壓縮後大小
    headerView.setUint32(22, size, true); // 原始大小（store，所以兩個一樣）
    headerView.setUint16(26, nameBytes.length, true);
    headerView.setUint16(28, 0, true); // extra field 長度
    header.set(nameBytes, 30);

    const record = new Uint8Array(46 + nameBytes.length);
    const recordView = new DataView(record.buffer);
    recordView.setUint32(0, 0x02014b50, true); // central directory header 簽章
    recordView.setUint16(4, 20, true); // 建立者版本
    recordView.setUint16(6, 20, true); // 需要的版本
    recordView.setUint16(8, 0x0800, true);
    recordView.setUint16(10, 0, true);
    recordView.setUint16(12, time, true);
    recordView.setUint16(14, date, true);
    recordView.setUint32(16, crc, true);
    recordView.setUint32(20, size, true);
    recordView.setUint32(24, size, true);
    recordView.setUint16(28, nameBytes.length, true);
    recordView.setUint16(30, 0, true); // extra
    recordView.setUint16(32, 0, true); // comment
    recordView.setUint16(34, 0, true); // 磁片編號
    recordView.setUint16(36, 0, true); // internal attrs
    recordView.setUint32(38, 0, true); // external attrs
    recordView.setUint32(42, offset, true); // 這一筆的 local header 從哪個位元組開始
    record.set(nameBytes, 46);

    parts.push(header, entry.blob);
    central.push(record);
    offset += header.length + size;
    if (offset > 0xffffffff) throw new ZipTooLargeError("打包後超過 4GB，zip 放不下");

    onProgress?.(i + 1, entries.length);
  }

  const centralOffset = offset;
  const centralSize = central.reduce((sum, record) => sum + record.length, 0);

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true); // end of central directory 簽章
  endView.setUint16(4, 0, true); // 這是第幾片磁片
  endView.setUint16(6, 0, true); // 目錄表從第幾片開始
  endView.setUint16(8, entries.length, true); // 這一片裡的筆數
  endView.setUint16(10, entries.length, true); // 總筆數
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  endView.setUint16(20, 0, true); // 註解長度

  return new Blob([...parts, ...central, end], { type: "application/zip" });
}
