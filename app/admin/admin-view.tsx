"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { PageHeader, TableWrap, Th, Td, Badge, Button } from "@/components/ui";
import { TOOLS_REGISTRY } from "@/lib/tools-registry";

interface AdminUser {
  id: string;
  username: string;
  name: string;
  tools: string[];
  isAdmin: boolean;
}

export function AdminView() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 哪些使用者的工具清單正在打 API 存檔，存檔中要把對應的勾選框 disable 掉，
  // 不然在請求還沒回來前使用者又勾了一次，畫面狀態跟資料庫會對不起來。
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data: { users?: AdminUser[]; error?: string }) => {
        if (data.users) setUsers(data.users);
        else setError(data.error ?? "讀取失敗");
      })
      .catch(() => setError("連線失敗，請稍後再試"));
  }, []);

  async function toggleTool(targetUser: AdminUser, toolId: string) {
    const nextTools = targetUser.tools.includes(toolId)
      ? targetUser.tools.filter((t) => t !== toolId)
      : [...targetUser.tools, toolId];

    setUsers((prev) => prev?.map((u) => (u.id === targetUser.id ? { ...u, tools: nextTools } : u)) ?? null);
    setSavingIds((prev) => new Set(prev).add(targetUser.id));
    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tools: nextTools }),
      });
      if (!res.ok) {
        // 存檔失敗就把畫面上的勾選改回原來的樣子，不要讓畫面跟資料庫長期不一致。
        setUsers((prev) => prev?.map((u) => (u.id === targetUser.id ? targetUser : u)) ?? null);
      }
    } catch {
      setUsers((prev) => prev?.map((u) => (u.id === targetUser.id ? targetUser : u)) ?? null);
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetUser.id);
        return next;
      });
    }
  }

  async function handleDelete(targetUser: AdminUser) {
    if (!window.confirm(`確定要刪除「${targetUser.name}（${targetUser.username}）」這個帳號嗎？這個人在各工具底下存的資料也會一併刪除，無法復原。`)) {
      return;
    }
    setDeletingIds((prev) => new Set(prev).add(targetUser.id));
    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}`, { method: "DELETE" });
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "刪除失敗");
        return;
      }
      setUsers((prev) => prev?.filter((u) => u.id !== targetUser.id) ?? null);
    } catch {
      setError("連線失敗，請稍後再試");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetUser.id);
        return next;
      });
    }
  }

  return (
    <div>
      <PageHeader title="管理後台" description="管理每個帳號能用哪些工具，或是刪除已註冊的帳號。" />

      {error && <p className="mb-4 text-sm text-negative">{error}</p>}

      {!users ? (
        <p className="text-sm text-muted">載入中…</p>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>帳號</Th>
              {TOOLS_REGISTRY.map((tool) => (
                <Th key={tool.toolId}>{tool.name}</Th>
              ))}
              <Th>刪除</Th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === me?.id;
              return (
                <tr key={u.id}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{u.name}</span>
                      <span className="text-xs text-muted">@{u.username}</span>
                      {u.isAdmin && <Badge tone="brand">管理者</Badge>}
                    </div>
                  </Td>
                  {TOOLS_REGISTRY.map((tool) => (
                    <Td key={tool.toolId}>
                      <input
                        type="checkbox"
                        checked={u.tools.includes(tool.toolId)}
                        disabled={savingIds.has(u.id)}
                        onChange={() => toggleTool(u, tool.toolId)}
                        className="size-4"
                      />
                    </Td>
                  ))}
                  <Td>
                    <Button
                      variant="secondary"
                      className="text-negative"
                      disabled={isSelf || deletingIds.has(u.id)}
                      onClick={() => handleDelete(u)}
                      title={isSelf ? "不能刪除自己目前登入的帳號" : undefined}
                    >
                      {deletingIds.has(u.id) ? "刪除中…" : "刪除"}
                    </Button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}
    </div>
  );
}
