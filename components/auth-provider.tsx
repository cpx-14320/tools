"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  tools: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** 全站共用的登入狀態，包在根 layout 裡——掛載時打一次 /api/auth/me 確認目前有沒有登入，
 *  登入／註冊／登出都會呼叫 refresh() 讓這裡的狀態跟著更新，不用整頁重新整理。 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    const data: { user?: AuthUser | null } = await res.json();
    setUser(data.user ?? null);
  }, []);

  useEffect(() => {
    // 掛載時查一次目前的登入狀態，查完（不管成功與否）才把 loading 關掉；
    // 這是掛載時的一次性初始化，不是在訂閱外部事件，屬於這個規則容許的例外。
    /* eslint-disable react-hooks/set-state-in-effect */
    refresh().finally(() => setLoading(false));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 必須在 AuthProvider 裡面使用");
  return ctx;
}
