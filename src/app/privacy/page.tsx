import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#090a10] text-gray-200">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-white">
              <Sparkles size={16} />
            </div>
            <div>
              <span className="text-sm font-bold text-white">Deployra CreatorAI</span>
              <span className="text-[10px] block text-violet-400">by Deployra.in</span>
            </div>
          </Link>
          <Link
            href="/"
            className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Home
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Security & Privacy</span>
          <h1 className="text-3xl font-black text-white mt-1">Privacy Policy</h1>
          <p className="text-xs text-gray-400 mt-2">Last updated: November 2026 · Deployra Private Limited (deployra.in)</p>
        </div>

        <section className="space-y-4 text-sm leading-relaxed text-gray-300">
          <h2 className="text-lg font-bold text-white">1. Overview</h2>
          <p>
            Deployra Private Limited (&ldquo;Deployra&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;) respects your privacy and is committed to protecting your personal data. This Privacy Policy details how we collect, process, and protect your information when you access Deployra CreatorAI Studio via <a href="https://deployra.in" target="_blank" rel="noreferrer" className="text-violet-400 underline">deployra.in</a> or associated application endpoints.
          </p>

          <h2 className="text-lg font-bold text-white pt-4">2. Information We Collect</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Account Data:</strong> Name, business email, business profile information, and organization settings.</li>
            <li><strong>Social & Ad Integrations:</strong> OAuth tokens for connected Facebook Pages, Instagram Professional accounts, LinkedIn Profiles, and Google Ads accounts to facilitate post publishing and ad campaign orchestration.</li>
            <li><strong>Billing Data:</strong> Payment transaction references processed through encrypted payment gateways (e.g. Stripe). We do not store raw credit card numbers.</li>
            <li><strong>AI Prompt & Campaign Input:</strong> Creative instructions, product descriptions, target audience choices, and campaign goals processed by our backend AI models.</li>
          </ul>

          <h2 className="text-lg font-bold text-white pt-4">3. How We Use Your Information</h2>
          <p>
            We use your data strictly to execute your requested marketing workflows:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Generating custom social posts, video scripts, and visual creatives.</li>
            <li>Publishing posts to your authorized social platforms.</li>
            <li>Configuring and monitoring your Meta and Google advertising campaigns.</li>
            <li>Managing your token balances, wallet top-ups, and subscription tier.</li>
          </ul>

          <h2 className="text-lg font-bold text-white pt-4">4. Third-Party Service Providers</h2>
          <p>
            We integrate with trusted enterprise providers including Anthropic (Claude API), Meta Platforms Inc. (Graph & Marketing APIs), Google Cloud, and Stripe. Your prompt data is transmitted securely over HTTPS and is never sold to data brokers.
          </p>

          <h2 className="text-lg font-bold text-white pt-4">5. Contact Information</h2>
          <div className="rounded-xl p-4 bg-white/5 border border-white/10 text-xs space-y-1">
            <p className="font-bold text-white">Deployra Private Limited</p>
            <p>Official Website: <a href="https://deployra.in" target="_blank" rel="noreferrer" className="text-violet-400 underline">https://deployra.in</a></p>
            <p>Email: <a href="mailto:privacy@deployra.in" className="text-violet-400 underline">privacy@deployra.in</a> / <a href="mailto:contact@deployra.in" className="text-violet-400 underline">contact@deployra.in</a></p>
            <p>Nashik, Maharashtra, India</p>
          </div>
        </section>
      </main>
    </div>
  );
}
