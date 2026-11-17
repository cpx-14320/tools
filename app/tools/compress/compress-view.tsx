"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, FaIcon, ListCard, SectionLabel } from "@/components/ui";
import {
  ACCEPT_ATTR,
  type CompressOptions,
  type OutputFormat,
  compressImage,
  formatBytes,
  isAcceptedFile,
  savedPercent,
  usesQuality,
} from "@/lib/compress/image";
import { ZipTooLargeError, buildZip } from "@/lib/compress/zip";

/** 圖片壓縮——選圖、壓、下載，全部在這一頁完成。
 *
 *  **沒有任何 API route**：壓縮是瀏覽器自己做的（見 lib/compress/image.ts 開頭那段），
 *  所以這一頁沒有 loading 骨架、沒有樂觀更新、也沒有「存檔失敗要還原」那些問題，
 *  state 就是畫面的全部真相。
 *
 *  **設定一改就全部重壓**：品質、格式、尺寸這三個旋鈕的效果看不到就等於沒有，使用者不該
 *  先調完再按一顆「開始壓縮」——那會變成「調一次按一次、看不出哪個設定造成的差別」。
 *  重壓的成本就是重新編碼一次（本機幾百毫秒），值得。
 *
 *  **每個項目用 appliedKey 記住「這份結果是哪組設定壓出來的」**，而不是用 isLoading 這種
 *  旗標。加檔案跟改設定都只呼叫同一支 processPending()，它每次都重新掃「有哪些項目的
 *  appliedKey 跟現在的設定不一樣」——所以「正在重壓時又丟進三張新圖」不會有項目被漏掉
 *  卡在轉圈圈（這是用旗標寫法最容易出的那個 bug）。 */

interface OutputInfo {
  blob: Blob;
  /** 這顆 blob 的 objectURL：清單縮圖、預覽、下載都用它。 */
  url: string;
  filename: string;
  size: number;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  usedOriginal: boolean;
  flattened: boolean;
  firstFrameOnly: boolean;
  /** 這張實際壓了多久。用來事後提醒「這張很慢，設個長邊上限會快很多」——與其猜圖多大
   *  算門檻，不如直接看它真的讓使用者等了幾秒。 */
  elapsedMs: number;
}

interface Item {
  id: string;
  file: File;
  /** 原檔的 objectURL——預覽要能切回「壓縮前」做比較，所以原檔的 URL 要一直留著。 */
  originalUrl: string;
  /** 目前這份 out／error 是用哪組設定算出來的（optsKey()）。跟現在的設定不同 ＝ 等著重壓。 */
  appliedKey: string | null;
  out: OutputInfo | null;
  error: string | null;
}

const FORMAT_OPTIONS: { value: OutputFormat; label: string }[] = [
  { value: "auto", label: "自動" },
  { value: "webp", label: "WebP" },
  { value: "jpeg", label: "JPEG" },
  { value: "png", label: "PNG" },
  { value: "keep", label: "原格式" },
];

const EDGE_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "原尺寸" },
  { value: 2048, label: "2048" },
  { value: 1600, label: "1600" },
  { value: 1200, label: "1200" },
  { value: 800, label: "800" },
];

function optsKey(o: CompressOptions): string {
  return `${o.format}|${o.quality}|${o.maxEdge ?? 0}`;
}

/** 單張的上限。瀏覽器的編碼器對上千萬像素的圖本來就慢（6000×6000 轉 WebP 在桌機要十秒），
 *  所以這個數字訂得很寬鬆——它不是「正常情況的等待時間」，而是「真的卡死了」的那條線：
 *  沒有它的話，一張解不開的圖會讓整個佇列永遠停在壓縮中，後面排隊的圖也跟著不動。 */
const COMPRESS_TIMEOUT_MS = 60_000;

/** 慢到該提醒使用者「可以用長邊上限換速度」的門檻。 */
const SLOW_MS = 3_000;

class TimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function CompressView() {
  const [format, setFormat] = useState<OutputFormat>("auto");
  const [quality, setQuality] = useState(0.75);
  const [maxEdge, setMaxEdge] = useState<number | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  /** 現在正在壓哪一張、從什麼時候開始。null ＝ 沒有在壓。 */
  const [processing, setProcessing] = useState<{ id: string; startedAt: number } | null>(null);
  /** 只為了讓「已經壓了幾秒」那個數字會跳動而存在的時鐘。 */
  const [now, setNow] = useState(0);
  /** 正在打包 ZIP 的進度。null ＝ 沒有在打包。 */
  const [zipping, setZipping] = useState<{ done: number; total: number } | null>(null);

  const opts: CompressOptions = { format, quality, maxEdge };
  const currentKey = optsKey(opts);
  const qualityApplies = usesQuality(format);

  const fileInputRef = useRef<HTMLInputElement>(null);
  // state 的 items 在 async 迴圈裡讀不到最新值（閉包抓的是那一次 render 的快照），
  // 壓縮迴圈要看的是「現在」的清單，所以另外同步一份 ref。
  const itemsRef = useRef<Item[]>([]);
  // 每一輪壓縮的流水號：改設定／加檔案都會 +1，進行中的那一輪看到號碼變了就自己收手，
  // 不要把舊設定壓出來的結果寫回畫面。
  const runRef = useRef(0);
  // 所有建出來的 objectURL，離開這一頁時要全部還掉（不還就是記憶體漏到關掉分頁為止）。
  const urlsRef = useRef<Set<string>>(new Set());

  const writeItems = useCallback((next: Item[] | ((prev: Item[]) => Item[])) => {
    // **ref 先改、state 後改，而且算新值是看 ref 不是看 prev**：itemsRef 才是這一頁的
    // 真實來源，setItems 只負責把它畫出來。
    //
    // 原本是在 setItems 的 updater 裡順手寫 itemsRef，那是錯的——updater 不保證同步執行，
    // 所以 addFiles 排完更新、立刻呼叫 processPending 時，迴圈讀到的還是「沒有新項目」的
    // 舊清單，掃不到待處理的圖就直接結束，那幾張就永遠停在「壓縮中」。
    // （單張慢慢丟時看起來正常，是因為 React 在更新佇列是空的時候會先跑一次 updater 做
    //  bail out 判斷，剛好把 ref 補上了。那是最佳化細節，不是保證，不能靠它。）
    const value = typeof next === "function" ? next(itemsRef.current) : next;
    itemsRef.current = value;
    setItems(value);
  }, []);

  const createUrl = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    urlsRef.current.add(url);
    return url;
  }, []);

  const releaseUrl = useCallback((url: string | undefined | null) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    urlsRef.current.delete(url);
  }, []);

  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  // 壓縮中的那一列要顯示「已經等了幾秒」，所以有圖在壓的時候每 100ms 推一次時鐘。
  // 沒在壓的時候不要留著這個 interval——一個閒置的頁面不該每秒重繪十次。
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [processing]);

  /** 掃出所有「結果不是用現在這組設定壓的」項目，一張一張壓。一次只壓一張是故意的：
   *  手機上同時解開三十張圖的點陣資料會直接被系統收掉分頁，排隊慢一點但不會死。 */
  const processPending = useCallback(
    async (runOpts: CompressOptions) => {
      const run = ++runRef.current;
      const key = optsKey(runOpts);

      for (;;) {
        if (run !== runRef.current) return;
        const target = itemsRef.current.find((it) => it.appliedKey !== key);
        if (!target) {
          setProcessing(null);
          return;
        }

        // 哪一張正在壓、從什麼時候開始——畫面要能回答「它到底還在不在動」。一張
        // 6000×6000 的圖在原尺寸下光編碼就要十秒，只寫「壓縮中…」看起來就是當掉了。
        setProcessing({ id: target.id, startedAt: Date.now() });
        setNow(Date.now());

        const previousUrl = target.out?.url;
        const startedAt = performance.now();
        try {
          const result = await withTimeout(compressImage(target.file, runOpts), COMPRESS_TIMEOUT_MS);
          if (run !== runRef.current) return;
          const elapsedMs = Math.round(performance.now() - startedAt);
          const url = createUrl(result.blob);
          writeItems((prev) =>
            prev.map((it) =>
              it.id === target.id
                ? {
                    ...it,
                    appliedKey: key,
                    error: null,
                    out: {
                      blob: result.blob,
                      url,
                      filename: result.filename,
                      size: result.blob.size,
                      width: result.width,
                      height: result.height,
                      sourceWidth: result.sourceWidth,
                      sourceHeight: result.sourceHeight,
                      usedOriginal: result.usedOriginal,
                      flattened: result.flattened,
                      firstFrameOnly: result.firstFrameOnly,
                      elapsedMs,
                    },
                  }
                : it,
            ),
          );
          // 舊結果的 URL 等新的寫進畫面才還——反過來會有一瞬間縮圖指向已經失效的 URL。
          releaseUrl(previousUrl);
        } catch (error) {
          if (run !== runRef.current) return;
          // 失敗也要蓋上 appliedKey，不然上面那個迴圈會一直挑到同一張，變成無窮迴圈。
          const message =
            error instanceof TimeoutError
              ? "這張圖太大，壓超過一分鐘還沒好，已經停下來——設一個長邊上限再試一次。"
              : "這張圖讀不出來，可能格式不符或檔案損壞";
          writeItems((prev) => prev.map((it) => (it.id === target.id ? { ...it, appliedKey: key, error: message } : it)));
        }
      }
    },
    [createUrl, releaseUrl, writeItems],
  );

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming);
      const rejected: string[] = [];
      const accepted: File[] = [];

      // 只擋「這根本不是我們能解的圖」。大小不擋——理由見 lib/compress/image.ts 那段：
      // 壓不動的圖會自己拋錯或逾時，訊息比事前用一個猜的位元組數拒絕掉更有用。
      for (const file of list) {
        if (isAcceptedFile(file)) accepted.push(file);
        else rejected.push(`${file.name}（不支援的格式）`);
      }

      if (accepted.length > 0) {
        const newItems: Item[] = accepted.map((file) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          originalUrl: createUrl(file),
          appliedKey: null,
          out: null,
          error: null,
        }));
        writeItems((prev) => [...prev, ...newItems]);
        void processPending({ format, quality, maxEdge });
      }

      setNotice(rejected.length > 0 ? `沒有加入：${rejected.join("、")}` : null);
    },
    [createUrl, format, maxEdge, processPending, quality, writeItems],
  );

  // 設定一改就重壓已經在清單裡的圖。拉品質滑桿的過程中會連續觸發，所以等手放開那一下
  // （250ms 沒有再變）才真的開始壓，不然拉一次滑桿等於排三十輪重壓。
  useEffect(() => {
    if (itemsRef.current.length === 0) return;
    const timer = setTimeout(() => void processPending({ format, quality, maxEdge }), 250);
    return () => clearTimeout(timer);
  }, [format, quality, maxEdge, processPending]);

  // 貼上（Ctrl/⌘ + V）也能加圖——截圖之後最自然的下一個動作就是貼，不該逼人先存檔再選檔。
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length > 0) {
        event.preventDefault();
        addFiles(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  // 拖放：整頁都收，不是只有那個虛線框。瀏覽器預設會「直接開啟」被拖進來的檔案（整頁
  // 被圖片取代、使用者辛苦排好的清單就不見了），所以 dragover／drop 一定要 preventDefault。
  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
      if (event.dataTransfer?.types.includes("Files")) setDragging(true);
    };
    const onDragLeave = (event: DragEvent) => {
      // relatedTarget 是 null ＝ 真的離開這個視窗，不是在子元素之間移動（那會一直閃）。
      if (!event.relatedTarget) setDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const files = event.dataTransfer?.files;
      if (files && files.length > 0) addFiles(files);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [addFiles]);

  const removeItem = (id: string) => {
    const target = itemsRef.current.find((it) => it.id === id);
    writeItems((prev) => prev.filter((it) => it.id !== id));
    if (previewId === id) setPreviewId(null);
    releaseUrl(target?.originalUrl);
    releaseUrl(target?.out?.url);
  };

  const clearAll = () => {
    // 流水號 +1 把進行中的那一輪停掉，不然它壓完會把結果寫回一個已經清空的清單。
    runRef.current += 1;
    const previous = itemsRef.current;
    writeItems([]);
    setPreviewId(null);
    setNotice(null);
    // 沒有下一輪會接手把它蓋掉，所以這裡要自己收：不收的話清空之後頁首還會寫著「壓縮中」。
    setProcessing(null);
    previous.forEach((it) => {
      releaseUrl(it.originalUrl);
      releaseUrl(it.out?.url);
    });
  };

  const done = items.filter((it) => it.appliedKey === currentKey && it.out);
  const working = items.filter((it) => it.appliedKey !== currentKey);
  const originalTotal = done.reduce((sum, it) => sum + it.file.size, 0);
  const compressedTotal = done.reduce((sum, it) => sum + (it.out?.size ?? 0), 0);
  /** 正數 ＝ 省下來的量，負數 ＝ 比原檔多出來的量（選 PNG 輸出照片時會這樣）。 */
  const totalDelta = originalTotal - compressedTotal;
  const preview = items.find((it) => it.id === previewId) ?? null;

  const downloadOne = (filename: string, url: string) => {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const downloadEach = async () => {
    // 一張一張隔開 300ms 送：連續觸發下載瀏覽器會判定成彈出式視窗濫用，只存到第一張。
    for (const it of done) {
      if (!it.out) continue;
      downloadOne(it.out.filename, it.out.url);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  };

  const downloadZip = async () => {
    const entries = done.flatMap((it) => (it.out ? [{ name: it.out.filename, blob: it.out.blob }] : []));
    if (entries.length === 0) return;

    setZipping({ done: 0, total: entries.length });
    try {
      const zip = await buildZip(entries, (count, total) => setZipping({ done: count, total }));
      const stamp = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const name = `compressed-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}.zip`;
      const url = URL.createObjectURL(zip);
      downloadOne(name, url);
      // 不要馬上 revoke：瀏覽器是在點下去之後才去讀這個 URL，太早收回會變成「下載失敗」。
      // 這顆 URL 不進 urlsRef——它跟某一張圖無關，離開頁面時也不需要跟著清。
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      setNotice(
        error instanceof ZipTooLargeError
          ? `${error.message}，請改用「逐張下載」。`
          : "打包失敗了，請改用「逐張下載」。",
      );
    } finally {
      setZipping(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">圖片壓縮</h1>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          圖片在你的裝置裡壓縮，不會上傳到伺服器。張數跟大小都沒有限制，一張壓完換下一張。
        </p>
      </div>

      {/* 拖放／選檔區。整個區塊是一顆 <button>：手機上根本沒有拖放這回事，點一下開檔案
          選擇器才是主要的用法，所以可點範圍要是整塊而不是裡面那行小字。 */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className={`flex w-full flex-col items-center gap-2 rounded-[1.5rem] border-2 border-dashed px-5 py-7 text-center transition-colors ${
          dragging ? "border-brand bg-brand-soft" : "border-[#DCD2F5] bg-white/70 hover:bg-white"
        }`}
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
          <FaIcon icon="image" size={20} />
        </span>
        <span className="text-sm font-semibold text-ink">{dragging ? "放手就開始壓縮" : "選擇圖片或拖進來"}</span>
        <span className="text-xs text-muted">支援 PNG、JPG、WebP、GIF、BMP、AVIF，也可以直接貼上截圖</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_ATTR}
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) addFiles(event.target.files);
          // 清掉 value：不清的話同一個檔案選第二次不會觸發 change（value 沒變），
          // 使用者會以為是壞的。
          event.target.value = "";
        }}
      />

      {notice && (
        <p className="rounded-2xl bg-negative-soft px-4 py-2.5 text-xs leading-relaxed text-negative">{notice}</p>
      )}

      <div>
        <SectionLabel>壓縮設定</SectionLabel>
        <div className="flex flex-col gap-3.5 rounded-2xl border border-line bg-surface p-4 shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)]">
          <Field label="輸出格式" hint={FORMAT_HINT[format]}>
            <Segmented options={FORMAT_OPTIONS} value={format} onChange={setFormat} />
          </Field>

          {/* 選了 PNG 就把滑桿關起來，不是放著讓它能拉——PNG 是無損的，拉了只會讓整批圖
              重壓一輪（大圖一張要十秒）然後大小一個 byte 都沒變。 */}
          <Field
            label="品質"
            value={qualityApplies ? `${Math.round(quality * 100)}%` : "不適用"}
            hint={
              !qualityApplies
                ? "PNG 是無損格式，沒有品質可以調——要變小只能靠下面的長邊上限。"
                : format === "keep"
                  ? "70%～80% 通常看不出差別。原格式是 PNG 的圖不吃這個設定（PNG 無損），只能靠縮尺寸。"
                  : "70%～80% 通常看不出差別，再往下調臉會開始糊。"
            }
          >
            <input
              type="range"
              min={40}
              max={95}
              step={5}
              value={Math.round(quality * 100)}
              disabled={!qualityApplies}
              onChange={(event) => setQuality(Number(event.target.value) / 100)}
              className="h-9 w-full accent-brand disabled:opacity-40"
            />
          </Field>

          <Field label="長邊上限" hint="用來當附件或貼網頁的圖，縮到 1600px 以內通常就夠，而且這一步最省。">
            <Segmented options={EDGE_OPTIONS} value={maxEdge} onChange={setMaxEdge} />
          </Field>
        </div>
      </div>

      {items.length > 0 && (
        <div>
          <SectionLabel>
            {done.length} / {items.length} 張已完成
            {working.length > 0 && (
              <span className="ml-1.5 text-brand">
                壓縮中{working.length > 1 && `（還有 ${working.length} 張）`}
              </span>
            )}
          </SectionLabel>

          {done.length > 0 && (
            <div
              className="mb-2.5 rounded-2xl px-4 py-3 text-white"
              style={{
                background: "linear-gradient(135deg, #8A7CEE 0%, #6F5FD6 60%, #6558C8 100%)",
                boxShadow: "0 16px 32px -16px rgba(111,95,214,0.9)",
              }}
            >
              {/* 變大的時候要說變大，不要把負數夾成 0 顯示「省下 0 B」——選 PNG 輸出照片
                  就是會變大（而且是好幾倍），那時候寫「省下 0」等於在騙人。 */}
              <p className="text-xs font-medium text-white/70">{totalDelta >= 0 ? "總共省下" : "總共多了"}</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight">
                {formatBytes(Math.abs(totalDelta))}
                <span className="ml-1.5 text-sm font-semibold text-white/80">
                  （{Math.abs(savedPercent(originalTotal, compressedTotal))}%）
                </span>
              </p>
              <p className="mt-1 text-xs text-white/80 tabular-nums">
                {formatBytes(originalTotal)} → {formatBytes(compressedTotal)}
              </p>
            </div>
          )}

          <ListCard>
            {items.map((it) => {
              const pending = it.appliedKey !== currentKey;
              const out = it.out;
              const saved = out ? savedPercent(it.file.size, out.size) : 0;
              // 正在壓的是「這一張」還是「排在前面那張」——兩種都還沒好，但訊息完全不同：
              // 一個要告訴使用者它在動（而且已經動了幾秒），另一個只要說還在排隊。
              const active = processing?.id === it.id;
              const waitedMs = active ? Math.max(0, now - processing.startedAt) : 0;

              return (
                <div key={it.id} className="flex items-center gap-3 px-3.5 py-3">
                  {/* 縮圖用壓縮後的那顆 blob（還沒壓完才退回原檔）——使用者看到的就是他要
                      下載的東西，品質掉太多在這裡就看得出來。 */}
                  <button
                    type="button"
                    onClick={() => out && setPreviewId(it.id)}
                    disabled={!out}
                    className="relative size-12 shrink-0 overflow-hidden rounded-xl border border-line bg-surface-2"
                  >
                    {/* loading="lazy"：清單沒有張數上限，一次丟幾百張時這些縮圖才是真正
                        的記憶體壓力（每張都要解碼成點陣資料，即使只畫 48px）。沒捲到的
                        就不要先解。 */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={out?.url ?? it.originalUrl} alt="" loading="lazy" className="size-full object-cover" />
                    {pending && (
                      // 轉圈只給正在壓的那一張。排隊中的也轉的話，畫面上會有五個都在轉的
                      // 圈圈，但實際上只有一張在動——那正是「看起來當掉了」的來源。
                      <span className={`absolute inset-0 grid place-items-center text-brand ${active ? "bg-white/70" : "bg-white/50"}`}>
                        {active ? <FaIcon icon="spinner" size={14} className="animate-spin" /> : <FaIcon icon="ellipsis" size={14} />}
                      </span>
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{out?.filename ?? it.file.name}</p>
                    {it.error ? (
                      <p className="mt-0.5 text-xs leading-snug text-negative">{it.error}</p>
                    ) : out ? (
                      <>
                        <p className="mt-0.5 text-xs tabular-nums text-muted">
                          {formatBytes(it.file.size)} → <span className="font-semibold text-ink">{formatBytes(out.size)}</span>
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {out.usedOriginal ? (
                            <Badge>已是最小，保留原檔</Badge>
                          ) : (
                            <Badge tone={saved > 0 ? "positive" : "neutral"}>{saved > 0 ? `省 ${saved}%` : "沒變小"}</Badge>
                          )}
                          {out.width !== out.sourceWidth && (
                            <Badge tone="brand">
                              {out.sourceWidth}×{out.sourceHeight} → {out.width}×{out.height}
                            </Badge>
                          )}
                          {out.flattened && <Badge tone="negative">透明已填白</Badge>}
                          {out.firstFrameOnly && <Badge tone="negative">只留第一格</Badge>}
                        </div>
                        {/* 這張讓人等很久，而且是在「原尺寸」等的——與其讓他下次再等一次，
                            不如直接說哪個設定可以換到速度。 */}
                        {out.elapsedMs >= SLOW_MS && maxEdge === null && (
                          <p className="mt-1 text-[11px] leading-snug text-muted">
                            這張 {out.sourceWidth}×{out.sourceHeight} 壓了 {formatSeconds(out.elapsedMs)}，設個長邊上限會快很多。
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="mt-0.5 text-xs tabular-nums text-muted">
                        {formatBytes(it.file.size)}
                        {active ? (
                          // 秒數是這裡最重要的東西：大圖在原尺寸下要十幾秒，沒有這個數字
                          // 跳動，使用者沒辦法分辨「還在壓」跟「當掉了」。
                          <span className="ml-1.5 font-semibold text-brand">壓縮中 {formatSeconds(waitedMs)}</span>
                        ) : (
                          <span className="ml-1.5 text-[#C7BFE6]">排隊中</span>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {out && (
                      <button
                        type="button"
                        onClick={() => downloadOne(out.filename, out.url)}
                        aria-label={`下載 ${out.filename}`}
                        className="grid size-9 place-items-center rounded-full bg-brand-soft text-brand active:scale-95"
                      >
                        <FaIcon icon="arrow-down" size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeItem(it.id)}
                      aria-label={`移除 ${it.file.name}`}
                      className="grid size-9 place-items-center rounded-full text-[#C7BFE6] active:scale-95"
                    >
                      <FaIcon icon="xmark" size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </ListCard>

          {/* 打包是主要路徑（一個檔案、一次對話框），逐張留著當備案：有人就是想直接拿到
              那幾張圖、不想再解壓縮，而且 zip 真的太大時也要有退路。 */}
          <div className="mt-3 flex gap-2">
            <Button onClick={() => void downloadZip()} disabled={done.length === 0 || zipping !== null} className="flex-1">
              <FaIcon icon={zipping ? "spinner" : "file-zipper"} size={12} className={zipping ? "animate-spin" : ""} />
              {zipping ? `打包中 ${zipping.done}/${zipping.total}` : `打包成 ZIP（${done.length}）`}
            </Button>
            <Button variant="secondary" onClick={clearAll} disabled={zipping !== null}>
              清空
            </Button>
          </div>
          <div className="mt-2 text-center">
            <Button variant="ghost" onClick={() => void downloadEach()} disabled={done.length === 0 || zipping !== null}>
              <FaIcon icon="arrow-down" size={11} />
              改成逐張下載
            </Button>
          </div>
          {done.length > 1 && (
            <p className="mt-1 px-1 text-center text-xs leading-relaxed text-muted">
              ZIP 不會再壓一次（圖片本來就壓好了，再壓也省不到），只是把 {done.length} 張裝進同一個檔案。
              <br />
              逐張下載則是一張一張存，瀏覽器可能會先問你要不要允許一次下載多個檔案。
            </p>
          )}
        </div>
      )}

      <p className="mt-auto pt-4 text-center text-xs leading-relaxed text-muted">
        壓縮用的是瀏覽器內建的編碼器，照片（JPG）跟半透明截圖（PNG → WebP）效果最好；
        <br />
        堅持留 PNG 的話只能靠縮尺寸變小。
      </p>

      {preview?.out && (
        <PreviewOverlay item={preview} onClose={() => setPreviewId(null)} onDownload={downloadOne} />
      )}
    </div>
  );
}

const FORMAT_HINT: Record<OutputFormat, string> = {
  auto: "JPG 留 JPG，其他一律轉 WebP——同畫質下最小，而且透明會留著。",
  webp: "最小，現在的瀏覽器跟手機都看得開；要給很舊的軟體用才需要換。",
  jpeg: "相容性最好，但不支援透明，透明的地方會被填成白色。",
  png: "無損、一定留得住透明，但照片轉 PNG 幾乎都會比原檔大。適合截圖、純色圖、要再編輯的圖。",
  keep: "副檔名不變。GIF／BMP／AVIF 編不回原格式，會退成 PNG 或 JPG。",
};

function Field({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-ink">{label}</p>
        {value && <p className="text-xs font-semibold tabular-nums text-brand">{value}</p>}
      </div>
      {children}
      {hint && <p className="mt-1 text-[11px] leading-snug text-muted">{hint}</p>}
    </div>
  );
}

/** 一排膠囊選一個。選項不多（最多五個）而且要一眼看完全部，所以不用下拉選單——
 *  下拉選單會把「現在可以選什麼」藏起來，還多一次點擊。 */
function Segmented<T extends string | number | null>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              on ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** 壓縮前後對照。
 *
 *  有這一頁最怕的事情是「壓完才發現糊了」，但清單裡的 48px 縮圖看不出畫質——所以要有一個
 *  能放大、而且能一鍵切回原圖比較的地方。底色刻意是灰白格子：PNG 轉 WebP 之後透明還在不在，
 *  在白底上看不出來。 */
function PreviewOverlay({
  item,
  onClose,
  onDownload,
}: {
  item: Item;
  onClose: () => void;
  onDownload: (filename: string, url: string) => void;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const out = item.out!;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-[418px] rounded-t-[1.75rem] bg-surface p-4 sm:rounded-[1.75rem]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{showOriginal ? item.file.name : out.filename}</p>
            <p className="mt-0.5 text-xs tabular-nums text-muted">
              {showOriginal
                ? `壓縮前 ${formatBytes(item.file.size)} · ${out.sourceWidth}×${out.sourceHeight}`
                : `壓縮後 ${formatBytes(out.size)} · ${out.width}×${out.height}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-muted"
          >
            <FaIcon icon="xmark" size={14} />
          </button>
        </div>

        <div
          className="grid max-h-[55vh] place-items-center overflow-hidden rounded-2xl border border-line"
          style={{
            backgroundColor: "#FFFFFF",
            backgroundImage:
              "linear-gradient(45deg, #EFEAF8 25%, transparent 25%), linear-gradient(-45deg, #EFEAF8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #EFEAF8 75%), linear-gradient(-45deg, transparent 75%, #EFEAF8 75%)",
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={showOriginal ? item.originalUrl : out.url}
            alt=""
            className="max-h-[55vh] w-auto max-w-full object-contain"
          />
        </div>

        <div className="mt-3 flex gap-2">
          <Button
            variant="secondary"
            onClick={() => setShowOriginal((v) => !v)}
            className="flex-1"
          >
            {showOriginal ? "看壓縮後" : "看原圖"}
          </Button>
          <Button onClick={() => onDownload(out.filename, out.url)} className="flex-1">
            <FaIcon icon="arrow-down" size={12} />
            下載
          </Button>
        </div>
      </div>
    </div>
  );
}
