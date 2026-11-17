"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, FaIcon, ListCard, SectionLabel } from "@/components/ui";
import {
  ACCEPT_ATTR,
  MAX_FILES,
  MAX_FILE_BYTES,
  type CompressOptions,
  type OutputFormat,
  compressImage,
  formatBytes,
  isAcceptedFile,
  savedPercent,
} from "@/lib/compress/image";

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

export function CompressView() {
  const [format, setFormat] = useState<OutputFormat>("auto");
  const [quality, setQuality] = useState(0.75);
  const [maxEdge, setMaxEdge] = useState<number | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const opts: CompressOptions = { format, quality, maxEdge };
  const currentKey = optsKey(opts);

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

  /** 掃出所有「結果不是用現在這組設定壓的」項目，一張一張壓。一次只壓一張是故意的：
   *  手機上同時解開三十張圖的點陣資料會直接被系統收掉分頁，排隊慢一點但不會死。 */
  const processPending = useCallback(
    async (runOpts: CompressOptions) => {
      const run = ++runRef.current;
      const key = optsKey(runOpts);

      for (;;) {
        if (run !== runRef.current) return;
        const target = itemsRef.current.find((it) => it.appliedKey !== key);
        if (!target) return;

        const previousUrl = target.out?.url;
        try {
          const result = await compressImage(target.file, runOpts);
          if (run !== runRef.current) return;
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
                    },
                  }
                : it,
            ),
          );
          // 舊結果的 URL 等新的寫進畫面才還——反過來會有一瞬間縮圖指向已經失效的 URL。
          releaseUrl(previousUrl);
        } catch {
          if (run !== runRef.current) return;
          // 失敗也要蓋上 appliedKey，不然上面那個迴圈會一直挑到同一張，變成無窮迴圈。
          writeItems((prev) =>
            prev.map((it) => (it.id === target.id ? { ...it, appliedKey: key, error: "這張圖讀不出來，可能格式不符或檔案損壞" } : it)),
          );
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

      for (const file of list) {
        if (!isAcceptedFile(file)) rejected.push(`${file.name}（不支援的格式）`);
        else if (file.size > MAX_FILE_BYTES) rejected.push(`${file.name}（超過 ${formatBytes(MAX_FILE_BYTES)}）`);
        else accepted.push(file);
      }

      const room = MAX_FILES - itemsRef.current.length;
      const taken = accepted.slice(0, Math.max(0, room));
      if (accepted.length > taken.length) rejected.push(`一次最多 ${MAX_FILES} 張，其餘沒有加入`);

      if (taken.length > 0) {
        const newItems: Item[] = taken.map((file) => ({
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
    previous.forEach((it) => {
      releaseUrl(it.originalUrl);
      releaseUrl(it.out?.url);
    });
  };

  const done = items.filter((it) => it.appliedKey === currentKey && it.out);
  const working = items.filter((it) => it.appliedKey !== currentKey);
  const originalTotal = done.reduce((sum, it) => sum + it.file.size, 0);
  const compressedTotal = done.reduce((sum, it) => sum + (it.out?.size ?? 0), 0);
  const preview = items.find((it) => it.id === previewId) ?? null;

  const downloadOne = (filename: string, url: string) => {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const downloadAll = async () => {
    // 一張一張隔開 300ms 送：連續觸發下載瀏覽器會判定成彈出式視窗濫用，只存到第一張。
    // （不打包成 zip 是為了不為了一顆按鈕多一個前端壓縮套件的相依。）
    for (const it of done) {
      if (!it.out) continue;
      downloadOne(it.out.filename, it.out.url);
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">圖片壓縮</h1>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          圖片在你的裝置裡壓縮，不會上傳到伺服器。一次最多 {MAX_FILES} 張，單張 {formatBytes(MAX_FILE_BYTES)} 以內。
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

          <Field
            label="品質"
            value={`${Math.round(quality * 100)}%`}
            hint={format === "keep" ? "PNG 沒有品質參數可以調，要變小只能縮尺寸。" : "70%～80% 通常看不出差別，再往下調臉會開始糊。"}
          >
            <input
              type="range"
              min={40}
              max={95}
              step={5}
              value={Math.round(quality * 100)}
              onChange={(event) => setQuality(Number(event.target.value) / 100)}
              className="h-9 w-full accent-brand"
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
            {working.length > 0 && <span className="ml-1.5 text-brand">壓縮中…</span>}
          </SectionLabel>

          {done.length > 0 && (
            <div
              className="mb-2.5 rounded-2xl px-4 py-3 text-white"
              style={{
                background: "linear-gradient(135deg, #8A7CEE 0%, #6F5FD6 60%, #6558C8 100%)",
                boxShadow: "0 16px 32px -16px rgba(111,95,214,0.9)",
              }}
            >
              <p className="text-xs font-medium text-white/70">總共省下</p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight">
                {formatBytes(Math.max(0, originalTotal - compressedTotal))}
                <span className="ml-1.5 text-sm font-semibold text-white/80">
                  （{Math.max(0, savedPercent(originalTotal, compressedTotal))}%）
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={out?.url ?? it.originalUrl} alt="" className="size-full object-cover" />
                    {pending && (
                      <span className="absolute inset-0 grid place-items-center bg-white/70 text-brand">
                        <FaIcon icon="spinner" size={14} className="animate-spin" />
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
                      </>
                    ) : (
                      <p className="mt-0.5 text-xs text-muted tabular-nums">{formatBytes(it.file.size)}</p>
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

          <div className="mt-3 flex gap-2">
            <Button onClick={() => void downloadAll()} disabled={done.length === 0} className="flex-1">
              <FaIcon icon="arrow-down" size={12} />
              下載全部（{done.length}）
            </Button>
            <Button variant="secondary" onClick={clearAll}>
              清空
            </Button>
          </div>
          {done.length > 1 && (
            <p className="mt-2 px-1 text-center text-xs leading-relaxed text-muted">
              「下載全部」會一張一張存，瀏覽器可能會先問你要不要允許一次下載多個檔案。
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
