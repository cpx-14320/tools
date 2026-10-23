"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "./modal";
import { text } from "./theme";

export function PageHeader({
  title,
  description,
  help,
  actions,
}: {
  title: string;
  /** 多半是一句說明文字；帳戶明細頁要在這裡放「圖示＋類型名稱」，所以也吃 JSX。
   *  純解釋性的說明請改放 help，那是收在問號裡、不佔版面的。 */
  description?: ReactNode;
  /** 頁面用法說明。給了就在標題右邊長一顆問號，點了用彈窗顯示——說明文字一直攤在標題
   *  下面會把每一頁的開頭都墊高一截，真正要看的內容被推到下面去。 */
  help?: ReactNode;
  actions?: ReactNode;
}) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
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
