import type { LeadStatus } from "@/types/database";

export const DISPLAY_STATUSES: LeadStatus[] = ["new", "contacted", "converted", "lost"];

export const STATUS_META: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  new: { label: "New", color: "#6366f1", bg: "rgba(99,102,241,0.15)" },
  contacted: { label: "Contacted", color: "#06b6d4", bg: "rgba(6,182,212,0.15)" },
  qualified: { label: "Qualified", color: "#8b5cf6", bg: "rgba(139,92,246,0.15)" },
  interested: { label: "Interested", color: "#8b5cf6", bg: "rgba(139,92,246,0.15)" },
  warm: { label: "Warm", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  hot: { label: "Hot", color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
  negotiation: { label: "Negotiation", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  converted: { label: "Converted", color: "#10b981", bg: "rgba(16,185,129,0.15)" },
  lost: { label: "Lost", color: "#6b7280", bg: "rgba(107,114,128,0.15)" },
};
