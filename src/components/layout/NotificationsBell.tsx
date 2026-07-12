"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bell, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from "@/lib/supabase/notifications";
import { useSessionStore } from "@/store/useSessionStore";
import type { Notification } from "@/types/database";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationsBell({ userId }: { userId: string | null }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const orgId = useSessionStore((s) => s.org?.id ?? null);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const refresh = () =>
      Promise.all([getNotifications(supabase, userId, 5), getUnreadCount(supabase, userId)]).then(
        ([list, count]) => {
          setNotifications(list);
          setUnreadCount(count);
        },
      );

    refresh();

    // No scheduler is deployed for this app, so overdue-task notifications
    // are generated opportunistically on page load rather than on a real
    // cron — see api/automations/check-overdue.
    if (orgId) {
      fetch("/api/automations/check-overdue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      })
        .then((res) => res.json())
        .then((data) => { if (data.notified > 0) refresh(); })
        .catch(() => {});
    }
  }, [userId, orgId]);

  const handleItemClick = async (n: Notification) => {
    if (n.is_read) return;
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    setUnreadCount((c) => Math.max(0, c - 1));
    const supabase = createClient();
    await markAsRead(supabase, n.id);
  };

  const handleMarkAllRead = async () => {
    if (!userId) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    const supabase = createClient();
    await markAllAsRead(supabase, userId);
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="relative p-2 rounded-lg transition-colors"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <Bell size={15} style={{ color: "var(--text-secondary)" }} />
          {unreadCount > 0 && (
            <span
              className="absolute top-1 right-1 w-2 h-2 rounded-full"
              style={{ background: "#7c3aed" }}
            />
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="w-80 rounded-xl p-1.5 z-50"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
        >
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-[11px] font-semibold"
                style={{ color: "#a78bfa" }}
              >
                <CheckCheck size={11} /> Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="text-xs px-2 py-4 text-center" style={{ color: "var(--text-muted)" }}>No notifications yet</p>
          ) : (
            notifications.map((n) => (
              <DropdownMenu.Item
                key={n.id}
                onSelect={(e) => { e.preventDefault(); handleItemClick(n); }}
                className="flex items-start gap-2 px-2.5 py-2 rounded-lg text-sm cursor-pointer outline-none transition-colors hover:bg-white/5"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
                  style={{ background: n.is_read ? "transparent" : "#7c3aed" }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs" style={{ color: n.is_read ? "var(--text-muted)" : "var(--text-secondary)" }}>{n.title}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{timeAgo(n.created_at)}</p>
                </div>
              </DropdownMenu.Item>
            ))
          )}

          <DropdownMenu.Separator style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
          <DropdownMenu.Item asChild>
            <Link
              href="/notifications"
              className="flex items-center justify-center px-2.5 py-2 rounded-lg text-xs font-semibold cursor-pointer outline-none transition-colors hover:bg-white/5"
              style={{ color: "#a78bfa" }}
            >
              View all
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
