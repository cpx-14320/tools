"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";

/** Hub 外殼右上角的登入狀態小標籤：手機版、電腦版外殼共用。loading 時先不顯示任何東西，
 *  避免先閃一下「登入」再跳成使用者名稱。 */
export function AuthStatus() {
  const { user, loading, logout } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <Link href="/login" className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium hover:bg-surface-2">
        登入
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="truncate text-xs font-medium text-muted">{user.name}</span>
      <button
        type="button"
        onClick={() => logout()}
        className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium hover:bg-surface-2"
      >
        登出
      </button>
    </div>
  );
}
