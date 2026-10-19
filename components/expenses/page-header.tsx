import type { ReactNode } from "react";
import { text } from "./theme";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  /** 多半是一句說明文字；帳戶明細頁要在這裡放「圖示＋類型名稱」，所以也吃 JSX。 */
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className={text.pageTitle}>{title}</h1>
        {description && <p className={`mt-1 ${text.muted}`}>{description}</p>}
      </div>
      {actions}
    </div>
  );
}
