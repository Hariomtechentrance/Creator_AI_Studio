import Header from "@/components/layout/Header";
import Link from "next/link";
import {
  Users, FileText, MessageSquare, TrendingUp, Brain,
  Send, BarChart3, Bot, ArrowUpRight, Clock,
  Target, Sparkles, Calendar,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserOrgs } from "@/lib/supabase/organizations";
import { resolveActiveOrg } from "@/lib/supabase/activeOrg";
import { getBrandProfile } from "@/lib/supabase/brand";
import { getLeads } from "@/lib/supabase/leads";
import { getAvgResponseTimeMinutes } from "@/lib/supabase/conversations";
import { DISPLAY_STATUSES, STATUS_META } from "@/lib/leads/status";
import type { Lead } from "@/types/database";

interface DashboardData {
  leads: Lead[];
  hasBrandProfile: boolean;
  newThisWeek: number;
  avgResponseMinutes: number | null;
}

async function getDashboardData(): Promise<DashboardData> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!supabaseUrl.startsWith("http")) return { leads: [], hasBrandProfile: false, newThisWeek: 0, avgResponseMinutes: null };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { leads: [], hasBrandProfile: false, newThisWeek: 0, avgResponseMinutes: null };

  const orgs = await getUserOrgs(supabase, user.id);
  const org = await resolveActiveOrg(orgs);
  if (!org) return { leads: [], hasBrandProfile: false, newThisWeek: 0, avgResponseMinutes: null };

  const [leads, brandProfile, avgResponseMinutes] = await Promise.all([
    getLeads(supabase, org.id),
    getBrandProfile(supabase, org.id),
    getAvgResponseTimeMinutes(supabase, org.id),
  ]);

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newThisWeek = leads.filter((l) => new Date(l.created_at).getTime() >= weekAgo).length;

  return { leads, hasBrandProfile: !!brandProfile, newThisWeek, avgResponseMinutes };
}

const MODULES = [
  {
    href: "/brand", icon: <Brain size={20} />, label: "Brand Intelligence",
    desc: "Set up your brand DNA — AI learns your voice, audience, and goals",
    badge: "Start here", badgeColor: "#7c3aed", gradient: "from-violet-600 to-purple-700", comingSoon: false,
  },
  {
    href: "/content", icon: <FileText size={20} />, label: "Content Studio",
    desc: "AI writes captions, hashtags, and variations for every platform",
    badge: "AI", badgeColor: "#06b6d4", gradient: "from-cyan-600 to-blue-700", comingSoon: false,
  },
  {
    href: "/leads", icon: <Users size={20} />, label: "Leads",
    desc: "Capture leads and see AI scoring based on your target audience",
    badge: "AI", badgeColor: "#10b981", gradient: "from-emerald-600 to-teal-700", comingSoon: false,
  },
  {
    href: "/community", icon: <MessageSquare size={20} />, label: "Community Manager",
    desc: "AI auto-replies to DMs and comments 24/7",
    badge: "Coming Soon", badgeColor: "#6b7280", gradient: "from-amber-600 to-orange-700", comingSoon: true,
  },
  {
    href: "/publish", icon: <Send size={20} />, label: "Publishing Hub",
    desc: "Schedule and publish to Instagram, LinkedIn, Facebook + more",
    badge: "Coming Soon", badgeColor: "#6b7280", gradient: "from-pink-600 to-rose-700", comingSoon: true,
  },
  {
    href: "/analytics", icon: <BarChart3 size={20} />, label: "Analytics",
    desc: "Track reach, engagement, lead gen, and ROI in one dashboard",
    badge: "Coming Soon", badgeColor: "#6b7280", gradient: "from-purple-600 to-violet-700", comingSoon: true,
  },
];

const QUICK_ACTIONS = [
  { href: "/leads", icon: <Users size={14} />, label: "Add Lead" },
  { href: "/image-generation", icon: <Sparkles size={14} />, label: "Generate Image" },
  { href: "/brand", icon: <Brain size={14} />, label: "Brand Intelligence" },
];

export default async function DashboardPage() {
  const { leads, hasBrandProfile, newThisWeek, avgResponseMinutes } = await getDashboardData();

  const totalLeads = leads.length;
  const converted = leads.filter((l) => l.status === "converted").length;
  const conversionRate = totalLeads > 0 ? Math.round((converted / totalLeads) * 100) : 0;
  const revenue = leads.reduce((sum, l) => sum + (l.converted_value ?? 0), 0);

  const METRICS = [
    { label: "Total Leads", value: String(totalLeads), sub: `+${newThisWeek} this week`, icon: <Users size={18} />, color: "#7c3aed" },
    { label: "Conversion Rate", value: `${conversionRate}%`, sub: `${converted} converted`, icon: <Target size={18} />, color: "#10b981" },
    { label: "Revenue Attributed", value: `₹${revenue.toLocaleString("en-IN")}`, sub: "from converted leads", icon: <TrendingUp size={18} />, color: "#f59e0b" },
    { label: "New This Week", value: String(newThisWeek), sub: "leads added", icon: <Sparkles size={18} />, color: "#06b6d4" },
    ...(avgResponseMinutes !== null
      ? [{ label: "Avg. Response Time", value: avgResponseMinutes < 60 ? `${avgResponseMinutes}m` : `${(avgResponseMinutes / 60).toFixed(1)}h`, sub: "lead message → human reply", icon: <Clock size={18} />, color: "#a855f7" }]
      : []),
  ];

  const allInsights: ({ icon: React.ReactNode; text: string; type: "tip" | "action" } | false)[] = [
    !hasBrandProfile && { icon: <Bot size={14} />, text: "Complete Brand Intelligence setup to unlock AI content generation", type: "tip" },
    totalLeads === 0 && { icon: <Target size={14} />, text: "Import leads from CSV or add your first lead to start tracking", type: "action" },
    { icon: <TrendingUp size={14} />, text: "Connect Instagram and Facebook (coming soon) to auto-capture leads from comments and DMs", type: "action" },
  ];
  const AI_INSIGHTS = allInsights.filter((x) => x !== false);

  return (
    <div>
      <Header title="Dashboard" />

      <div className="p-6 space-y-6 max-w-7xl mx-auto">

        {/* Welcome hero */}
        <div
          className="relative overflow-hidden rounded-2xl p-7"
          style={{
            background: "linear-gradient(135deg, rgba(124,58,237,0.18), rgba(99,102,241,0.08))",
            border: "1px solid rgba(124,58,237,0.3)",
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse 55% 80% at 85% 50%, rgba(124,58,237,0.12), transparent)" }}
          />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="flex-1">
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full mb-3"
                style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.35)", color: "#c4b5fd" }}
              >
                <Bot size={11} /> AI Growth OS — Active
              </span>
              <h2 className="text-2xl font-black text-white mb-1.5">
                Welcome to <span style={{ background: "linear-gradient(135deg,#a78bfa,#818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>GrowthPilot AI</span>
              </h2>
              <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                Your AI-powered marketing command center. Set up your brand to unlock all agents.
              </p>
              <div className="flex flex-wrap gap-2.5">
                {QUICK_ACTIONS.map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                    style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
                  >
                    {a.icon} {a.label}
                  </Link>
                ))}
              </div>
            </div>
            <Link
              href="/brand"
              className="shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
              style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 0 30px rgba(124,58,237,0.4)" }}
            >
              <Brain size={15} /> Set Up Brand <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {METRICS.map((m) => (
            <div
              key={m.label}
              className="rounded-xl p-4 flex items-center gap-3"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${m.color}18`, border: `1px solid ${m.color}35` }}
              >
                <span style={{ color: m.color }}>{m.icon}</span>
              </div>
              <div className="min-w-0">
                <p className="text-xl font-black text-white leading-none">{m.value}</p>
                <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{m.label}</p>
                <p className="text-[10px] font-semibold mt-0.5" style={{ color: m.color }}>{m.sub}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-5">

          {/* Modules grid */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">All Modules</h3>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{MODULES.length} modules</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {MODULES.map((m) => {
                const card = (
                  <div
                    className={`group flex gap-3 p-4 rounded-xl transition-all ${m.comingSoon ? "opacity-60" : "hover:scale-[1.01] active:scale-[0.99]"}`}
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 bg-gradient-to-br ${m.gradient}`}
                      style={{ boxShadow: `0 4px 14px ${m.badgeColor}35` }}
                    >
                      {m.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-bold text-white truncate">{m.label}</p>
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0"
                          style={{ background: `${m.badgeColor}20`, color: m.badgeColor, border: `1px solid ${m.badgeColor}40` }}
                        >
                          {m.badge}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>{m.desc}</p>
                    </div>
                    {!m.comingSoon && (
                      <ArrowUpRight size={13} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" style={{ color: "var(--text-muted)" }} />
                    )}
                  </div>
                );
                return m.comingSoon ? (
                  <div key={m.href} className="cursor-default">{card}</div>
                ) : (
                  <Link key={m.href} href={m.href}>{card}</Link>
                );
              })}
            </div>
          </div>

          {/* AI Insights sidebar */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Bot size={15} style={{ color: "#a78bfa" }} />
              <h3 className="text-base font-bold text-white">AI Recommendations</h3>
            </div>
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--border)" }}
            >
              {AI_INSIGHTS.map((insight, i) => (
                <div
                  key={i}
                  className="p-3.5 flex gap-3"
                  style={{
                    borderBottom: i < AI_INSIGHTS.length - 1 ? "1px solid var(--border)" : "none",
                    background: "var(--bg-card)",
                  }}
                >
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background: insight.type === "tip" ? "rgba(124,58,237,0.15)" : "rgba(16,185,129,0.15)",
                      color: insight.type === "tip" ? "#a78bfa" : "#34d399",
                    }}
                  >
                    {insight.icon}
                  </div>
                  <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {insight.text}
                  </p>
                </div>
              ))}
            </div>

            {/* Upcoming / schedule */}
            <div className="flex items-center gap-2 mt-4">
              <Calendar size={14} style={{ color: "var(--text-muted)" }} />
              <h3 className="text-sm font-bold text-white">Upcoming Posts</h3>
            </div>
            <div
              className="rounded-xl p-4 flex flex-col items-center justify-center gap-2 py-8"
              style={{ background: "var(--bg-card)", border: "2px dashed var(--border)" }}
            >
              <Clock size={22} style={{ color: "var(--text-muted)" }} />
              <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>No scheduled posts</p>
            </div>

            {/* Leads snapshot */}
            <div className="flex items-center gap-2 mt-4">
              <Users size={14} style={{ color: "var(--text-muted)" }} />
              <h3 className="text-sm font-bold text-white">Leads Snapshot</h3>
            </div>
            {DISPLAY_STATUSES.map((s) => {
              const meta = STATUS_META[s];
              const count = leads.filter((l) => l.status === s).length;
              return (
                <div key={s} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
                  <span className="flex-1 text-xs" style={{ color: "var(--text-secondary)" }}>{meta.label}</span>
                  <span className="text-xs font-bold" style={{ color: meta.color }}>{count}</span>
                </div>
              );
            })}
          </div>

        </div>

      </div>
    </div>
  );
}
