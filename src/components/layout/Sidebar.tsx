"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, MessageSquare, FileText,
  Calendar, Send, BarChart3, Zap, Bot, Settings, ChevronDown,
  ChevronRight, Sparkles, Target, Megaphone, Brain, Image as ImageIcon, Video,
  Layers, TrendingUp, Bell, CreditCard, PlusCircle, Share2, Palette, Puzzle,
  UserCircle,
} from "lucide-react";
import { useState } from "react";
import OrgSwitcher from "@/components/layout/OrgSwitcher";
import { useSessionStore } from "@/store/useSessionStore";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: "purple" | "red" | "orange" | "green";
}

interface NavSection {
  title: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    defaultOpen: true,
    items: [
      { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard size={15} /> },
    ],
  },
  {
    title: "Brand & Strategy",
    defaultOpen: true,
    items: [
      { label: "Brand Intelligence", href: "/brand", icon: <Brain size={15} />, badge: "AI", badgeColor: "purple" },
      { label: "Brand Kit", href: "/brand-kit", icon: <Palette size={15} /> },
      { label: "Campaigns", href: "/campaigns", icon: <Megaphone size={15} /> },
    ],
  },
  {
    title: "Content",
    defaultOpen: true,
    items: [
      { label: "Content Studio", href: "/content", icon: <FileText size={15} />, badge: "AI", badgeColor: "purple" },
      { label: "Calendar", href: "/content/calendar", icon: <Calendar size={15} /> },
      { label: "Publishing Hub", href: "/publish", icon: <Send size={15} /> },
      { label: "Landing Pages", href: "/landing-pages", icon: <Layers size={15} />, badge: "AI", badgeColor: "purple" },
    ],
  },
  {
    title: "Leads",
    defaultOpen: true,
    items: [
      { label: "All Leads", href: "/leads", icon: <Users size={15} /> },
      { label: "Tasks", href: "/tasks", icon: <Target size={15} /> },
    ],
  },
  {
    title: "Community",
    defaultOpen: true,
    items: [
      { label: "Inbox", href: "/community", icon: <MessageSquare size={15} /> },
      { label: "Social Accounts", href: "/social-accounts", icon: <Share2 size={15} /> },
    ],
  },
  {
    title: "AI Agents",
    defaultOpen: true,
    items: [
      { label: "AI Agents", href: "/ai-agents", icon: <Bot size={15} />, badge: "Beta", badgeColor: "orange" },
      { label: "Automations", href: "/automations", icon: <Zap size={15} /> },
      { label: "Marketplace", href: "/marketplace", icon: <Puzzle size={15} />, badge: "Soon", badgeColor: "orange" },
    ],
  },
  {
    title: "Analytics",
    defaultOpen: true,
    items: [
      { label: "Analytics", href: "/analytics", icon: <BarChart3 size={15} /> },
      { label: "AI Insights", href: "/ai-insights", icon: <TrendingUp size={15} />, badge: "AI", badgeColor: "purple" },
    ],
  },
  {
    title: "Creative Studio",
    defaultOpen: true,
    items: [
      { label: "AI Image Studio", href: "/image-generation", icon: <ImageIcon size={15} /> },
      { label: "AI Video Studio", href: "/video-generation", icon: <Video size={15} /> },
      { label: "AI Avatar Studio", href: "/avatar-studio", icon: <UserCircle size={15} />, badge: "AI", badgeColor: "purple" },
      { label: "Textures & 3D", href: "/textures-3d", icon: <Layers size={15} /> },
      { label: "Upscaler", href: "/upscaler", icon: <Zap size={15} /> },
      { label: "Model Training", href: "/model-training", icon: <Brain size={15} /> },
      { label: "Canvas", href: "/canvas", icon: <Layers size={15} /> },
    ],
  },
  {
    title: "Account",
    defaultOpen: false,
    items: [
      { label: "Notifications", href: "/notifications", icon: <Bell size={15} /> },
      { label: "Plans & Credits", href: "/pricing", icon: <CreditCard size={15} /> },
      { label: "Settings", href: "/settings", icon: <Settings size={15} /> },
    ],
  },
];

const BADGE_STYLES: Record<string, string> = {
  purple: "bg-violet-500/20 text-violet-300 border border-violet-500/30",
  red:    "bg-red-500/20 text-red-300 border border-red-500/30",
  orange: "bg-orange-500/20 text-orange-300 border border-orange-500/30",
  green:  "bg-green-500/20 text-green-300 border border-green-500/30",
};

export default function Sidebar() {
  const pathname = usePathname();
  const org = useSessionStore((s) => s.org);
  const whiteLabelName = org?.white_label_enabled ? org.white_label_name : null;

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    NAV_SECTIONS.forEach((s) => { init[s.title] = !(s.defaultOpen ?? true); });
    return init;
  });

  const toggleSection = (title: string) =>
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-60 flex flex-col z-40 overflow-hidden"
      style={{ background: "var(--bg-secondary)", borderRight: "1px solid var(--border)" }}
    >
      {/* Logo */}
      <div
        className="h-14 flex items-center px-4 gap-2.5 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shrink-0">
          <Sparkles size={13} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-none">{whiteLabelName || "GrowthPilot"}</p>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{whiteLabelName ? "Powered by GrowthPilot" : "AI Growth OS"}</p>
        </div>
      </div>

      {/* Quick create */}
      <div className="px-3 pt-3 pb-1 shrink-0">
        <Link
          href="/content/create"
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-95"
          style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)" }}
        >
          <PlusCircle size={13} />
          Create Content
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 pt-1 pb-2 space-y-0.5" style={{ scrollbarWidth: "none" }}>
        {NAV_SECTIONS.map((section) => {
          const isCollapsed = collapsed[section.title];
          return (
            <div key={section.title} className="mb-0.5">
              <button
                onClick={() => toggleSection(section.title)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-white/5 transition-colors"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                  {section.title}
                </span>
                {isCollapsed
                  ? <ChevronRight size={9} style={{ color: "var(--text-muted)" }} />
                  : <ChevronDown size={9} style={{ color: "var(--text-muted)" }} />
                }
              </button>

              {!isCollapsed && (
                <div className="space-y-0.5 mt-0.5">
                  {section.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all group"
                        style={{
                          background: active ? "rgba(124,58,237,0.15)" : "transparent",
                          border: active ? "1px solid rgba(124,58,237,0.25)" : "1px solid transparent",
                          color: active ? "#c4b5fd" : "var(--text-secondary)",
                        }}
                      >
                        <span className={`shrink-0 transition-colors ${active ? "text-violet-400" : "text-gray-500 group-hover:text-gray-300"}`}>
                          {item.icon}
                        </span>
                        <span className="flex-1 text-[12.5px] font-medium truncate">{item.label}</span>
                        {item.badge && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${BADGE_STYLES[item.badgeColor ?? "purple"]}`}>
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Org / plan footer */}
      <div className="shrink-0 p-3" style={{ borderTop: "1px solid var(--border)" }}>
        <OrgSwitcher />
      </div>
    </aside>
  );
}
