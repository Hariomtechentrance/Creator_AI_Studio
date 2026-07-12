"use client";

import { Search, Zap, ChevronDown, Settings, LogOut } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/store/useSessionStore";
import { createClient } from "@/lib/supabase/client";
import NotificationsBell from "@/components/layout/NotificationsBell";

export default function Header({ title }: { title?: string }) {
  const router = useRouter();
  const profile = useSessionStore((s) => s.profile);

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // fall through to redirect regardless
    }
    router.push("/auth/login");
    router.refresh();
  };

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-4 px-6 py-3"
      style={{
        background: "rgba(10,10,15,0.8)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Title */}
      {title && (
        <h1 className="text-base font-semibold text-white mr-auto">{title}</h1>
      )}
      {!title && <div className="flex-1" />}

      {/* Search */}
      <div
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)", minWidth: 200 }}
      >
        <Search size={14} />
        <span>Search…</span>
        <span className="ml-auto text-xs opacity-50">⌘K</span>
      </div>

      {/* Credits badge */}
      {profile && (
        <div
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold"
          style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: "#fbbf24" }}
        >
          <Zap size={13} />
          <span>{profile.credits}</span>
        </div>
      )}

      {/* Notifications */}
      <NotificationsBell userId={profile?.id ?? null} />

      {/* User avatar */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ background: "linear-gradient(135deg,#7c3aed,#6366f1)" }}
            >
              {profile?.full_name?.[0]?.toUpperCase() ?? "U"}
            </div>
            <ChevronDown size={12} style={{ color: "var(--text-muted)" }} />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className="min-w-44 rounded-xl p-1.5 z-50"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
          >
            <DropdownMenu.Item
              onSelect={() => router.push("/settings")}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm cursor-pointer outline-none transition-colors hover:bg-white/5"
              style={{ color: "var(--text-secondary)" }}
            >
              <Settings size={14} /> Settings
            </DropdownMenu.Item>
            <DropdownMenu.Separator style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
            <DropdownMenu.Item
              onSelect={handleSignOut}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm cursor-pointer outline-none transition-colors hover:bg-white/5"
              style={{ color: "#f87171" }}
            >
              <LogOut size={14} /> Sign out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </header>
  );
}
