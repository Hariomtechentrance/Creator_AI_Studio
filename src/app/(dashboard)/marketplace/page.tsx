import Header from "@/components/layout/Header";
import Link from "next/link";
import { LayoutTemplate, Workflow, Puzzle, Zap, ArrowRight } from "lucide-react";

const VISION_ITEMS = [
  { icon: <LayoutTemplate size={20} />, label: "AI Templates", desc: "Share and reuse landing pages, ad copy, and content-plan templates across businesses." },
  { icon: <Workflow size={20} />, label: "Automation Marketplace", desc: "Browse and install pre-built automation recipes (follow-up sequences, lead-routing rules)." },
  { icon: <Zap size={20} />, label: "AI Workflows", desc: "Chain multiple AI agents/tools into a single reusable pipeline." },
  { icon: <Puzzle size={20} />, label: "Plugins", desc: "Third-party integrations built by the community on top of GrowthPilot's data model." },
];

export default function MarketplacePage() {
  return (
    <div>
      <Header title="AI Marketplace" />
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="rounded-2xl p-5 text-center" style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.15),rgba(99,102,241,0.08))", border: "1px solid rgba(124,58,237,0.3)" }}>
          <span className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-3" style={{ background: "rgba(124,58,237,0.2)", color: "#c4b5fd" }}>Roadmap — not built yet</span>
          <h2 className="text-xl font-black text-white mb-1.5">The AI Marketplace is a future vision</h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            No listings, purchases, or plugin system exist yet — there&apos;s no seller/buyer infrastructure in this workspace. Here&apos;s what it&apos;s meant to become, and what you can already do today that points toward it.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {VISION_ITEMS.map((item) => (
            <div key={item.label} className="rounded-2xl p-4" style={{ background: "var(--bg-card)", border: "1px dashed var(--border)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2" style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa" }}>{item.icon}</div>
              <p className="text-sm font-bold text-white">{item.label}</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl p-4 space-y-2" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-bold text-white">Available today, within your own workspace</p>
          <Link href="/automations" className="flex items-center justify-between text-sm rounded-lg px-3 py-2 transition-colors hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
            Automation templates (follow-up task, assignee notification) <ArrowRight size={13} />
          </Link>
          <Link href="/landing-pages" className="flex items-center justify-between text-sm rounded-lg px-3 py-2 transition-colors hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
            AI-generated landing pages <ArrowRight size={13} />
          </Link>
          <Link href="/content" className="flex items-center justify-between text-sm rounded-lg px-3 py-2 transition-colors hover:bg-white/5" style={{ color: "var(--text-secondary)" }}>
            AI content generation presets <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}
