"use client";

import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { markAsRead, markAllAsRead } from "@/lib/supabase/notifications";
import type { Notification } from "@/types/database";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function NotificationsList({ userId, initialNotifications }: { userId: string | null; initialNotifications: Notification[] }) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleClick = async (n: Notification) => {
    if (n.is_read) return;
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    const supabase = createClient();
    await markAsRead(supabase, n.id);
  };

  const handleMarkAllRead = async () => {
    if (!userId) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    const supabase = createClient();
    await markAllAsRead(supabase, userId);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.25)" }}
          >
            <CheckCheck size={12} /> Mark all as read
          </button>
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24" style={{ color: "var(--text-muted)" }}>
          <Bell size={48} className="opacity-20 mb-4" />
          <p className="text-lg font-semibold" style={{ color: "var(--text-secondary)" }}>No notifications yet</p>
          <p className="text-sm mt-1">You&apos;ll see updates about your leads and team here</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {notifications.map((n, i) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className="w-full text-left flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]"
              style={{
                borderBottom: i < notifications.length - 1 ? "1px solid var(--border)" : "none",
                background: n.is_read ? "transparent" : "rgba(124,58,237,0.05)",
              }}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                style={{ background: n.is_read ? "transparent" : "#7c3aed" }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm" style={{ color: n.is_read ? "var(--text-muted)" : "white" }}>{n.title}</p>
                {n.body && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{n.body}</p>}
                <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{formatDate(n.created_at)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
