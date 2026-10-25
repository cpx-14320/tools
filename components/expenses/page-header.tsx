"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "./modal";
import { text } from "./theme";

export function PageHeader({
  title,
  description,
  help,
  actions,
  flush = false,
}: {
  title: string;
  /** 多半是一句說明文字；帳戶明細頁要在這裡放「圖示＋類型名稱」，所以也吃 JSX。
   *  純解釋性的說明請改放 help，那是收在問號裡、不佔版面的。 */
  description?: ReactNode;
  /** 頁面用法說明。給了就在標題右邊長一顆問號，點了用彈窗顯示——說明文字一直攤在標題
   *  下面會把每一頁的開頭都墊高一截，真正要看的內容被推到下面去。 */
  help?: ReactNode;
  actions?: ReactNode;
  /** 自己不要下邊距。大部分頁面的最外層沒有 gap，靠這裡的 mb-3 跟下面的內容隔開；
   *  但報表頁的最外層是 flex flex-col gap-4，兩個加起來變成 28px，標題跟下面那排分頁
   *  中間空一大截。那種頁面傳 flush，間距交給外層的 gap 統一控制。 */
  flush?: boolean;
}) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 ${flush ? "" : "mb-3"}`}>
      <div>
        <div className="flex items-center gap-1.5">
          <h1 className={text.pageTitle}>{title}</h1>
          {help && (
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-label={`${title}的說明`}
              className="grid size-5 shrink-0 place-items-center rounded-full bg-[#F3EFFC] text-[11px] font-bold text-[#6F5FD6] transition-colors hover:bg-[#EFEAFC]"
            >
              ?
            </button>
          )}
        </div>
        {description && <p className={`mt-1 ${text.muted}`}>{description}</p>}
      </div>
      {actions}

      {help && (
        <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title={title}>
          {/* 字串直接包成一段；要分段或放清單的頁面自己傳 JSX 進來。 */}
          {typeof help === "string" ? <p className={`${text.muted} leading-relaxed`}>{help}</p> : help}
        </Modal>
      )}
    </div>
  );
}
