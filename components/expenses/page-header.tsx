import type { ReactNode } from "react";
import { text } from "./theme";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className={text.pageTitle}>{title}</h1>
        {description && <p className={`mt-1 ${text.muted}`}>{description}</p>}
      </div>
      {actions}
    </div>
  );
}
