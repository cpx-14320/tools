"use client";

import { useLayoutMode } from "@/components/layout-mode-context";

export function LayoutToggle({ className = "" }: { className?: string }) {
  const { mode, setMode } = useLayoutMode();

  return (
    <button
      type="button"
      onClick={() => setMode(mode === "mobile" ? "desktop" : "mobile")}
      className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted shadow-sm transition-colors hover:text-ink ${className}`}
      aria-label={mode === "mobile" ? "切換成電腦版佈局" : "切換成手機版佈局"}
    >
      <span aria-hidden>{mode === "mobile" ? "💻" : "📱"}</span>
      {mode === "mobile" ? "電腦版" : "手機版"}
    </button>
  );
}
