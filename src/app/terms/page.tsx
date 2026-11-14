import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";

export default function TermsPage() {
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
          <span className="text-xs font-bold uppercase tracking-wider text-violet-400">Legal Agreement</span>
          <h1 className="text-3xl font-black text-white mt-1">Terms and Conditions</h1>
          <p className="text-xs text-gray-400 mt-2">Last updated: November 2026 · Operated by Deployra Private Limited (deployra.in)</p>
        </div>

        <section className="space-y-4 text-sm leading-relaxed text-gray-300">
          <h2 className="text-lg font-bold text-white">1. Acceptance of Terms</h2>
          <p>
            Welcome to Deployra CreatorAI Studio (&ldquo;Platform&rdquo;, &ldquo;Service&rdquo;), a cloud marketing automation and AI creative operating system developed and operated by Deployra Private Limited (&ldquo;Deployra&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;), having its official web presence at <a href="https://deployra.in" target="_blank" rel="noreferrer" className="text-violet-400 underline">deployra.in</a>.
          </p>
          <p>
            By accessing or using our Service, creating an account, topping up a platform wallet, or subscribing to our monthly packages, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
          </p>

          <h2 className="text-lg font-bold text-white pt-4">2. Description of Services & AI Copilot</h2>
          <p>
            Deployra CreatorAI provides tools for AI-powered copywriting (Claude 3.5 Sonnet / 3.7 Copilot), video rendering, social post generation, and automated advertising campaign creation on Meta (Facebook, Instagram) and Google Ads. Deployra supplies backend model access so that users do not need individual accounts or API subscriptions with AI providers.
          </p>

          <h2 className="text-lg font-bold text-white pt-4">3. Ad Spend, Wallets & Meta Billing</h2>
          <p>
            The Platform offers two modes of advertising campaign execution:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Self-Managed (BYO Ad Account):</strong> The client connects their own Meta or Google Ads account. Ad spend is billed directly by Meta or Google to the client&rsquo;s attached payment method. Deployra charges solely for the software subscription and AI token compute.
            </li>
            <li>
              <strong>Managed Ad Wallet (Done-For-You Bundles):</strong> The client deposits funds into their Deployra platform wallet (e.g. ₹10,000 / month package). The ad budget portion (e.g. ₹5,000) is allocated to run campaigns, and the software portion covers generation and management. All ad spend is prepaid; campaigns are automatically halted when the wallet budget is reached.
            </li>
          </ul>

          <h2 className="text-lg font-bold text-white pt-4">4. Intellectual Property & Content Ownership</h2>
          <p>
            You retain 100% ownership of all brand assets, logos, and media you upload to the Platform. As between you and Deployra, you own all rights in the output text, scripts, and creative cards generated for your business, subject to applicable third-party platform terms (Meta Graph API, Anthropic, Google Ads).
          </p>

          <h2 className="text-lg font-bold text-white pt-4">5. Acceptable Use Policy</h2>
          <p>
            You agree not to use the Platform to generate hate speech, fraudulent or misleading financial schemes, non-consensual imagery, unauthorized adult content, or any material violating Meta Advertising Standards or local laws of India.
          </p>

          <h2 className="text-lg font-bold text-white pt-4">6. Contact & Grievances</h2>
          <p>
            For any billing questions, service support, or legal inquiries, please contact:
          </p>
          <div className="rounded-xl p-4 bg-white/5 border border-white/10 text-xs space-y-1">
            <p className="font-bold text-white">Deployra Private Limited</p>
            <p>Official Website: <a href="https://deployra.in" target="_blank" rel="noreferrer" className="text-violet-400 underline">https://deployra.in</a></p>
            <p>Email: <a href="mailto:support@deployra.in" className="text-violet-400 underline">support@deployra.in</a> / <a href="mailto:contact@deployra.in" className="text-violet-400 underline">contact@deployra.in</a></p>
            <p>Location: Nashik, Maharashtra, India</p>
          </div>
        </section>
      </main>
    </div>
  );
}
