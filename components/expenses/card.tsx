import type { ReactNode } from "react";
import { colors } from "./theme";

/** 記帳本共用卡片——白底、rounded-2xl、搭乘車那套淡紫陰影＋邊框，原本只有總覽頁
 *  （dashboard-view.tsx）自己定義了一份，現在搬出來給其他頁面一起用。Card 本身不帶
 *  padding（只負責外觀），內容的留白交給 CardBody，比照 components/ui.tsx 原本
 *  Card／CardBody 的分工，換頁面時版面结構不用跟著大改。 */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl bg-white shadow-[0_6px_20px_-8px_rgba(111,95,214,0.2)] ${className}`}
      style={{ border: `1px solid ${colors.border}` }}
    >
      {children}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}
