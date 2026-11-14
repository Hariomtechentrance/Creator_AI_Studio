"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles, Bot, Rocket, Megaphone, Video, Layers,
  ArrowRight, ShieldCheck, Check,
  ExternalLink, Mail, MapPin, ChevronRight,
  Users, Globe,
} from "lucide-react";

export default function LandingPage() {
  const [billingMode, setBillingMode] = useState<"software" | "managed">("managed");
  const [activeDemoTab, setActiveDemoTab] = useState<"posts" | "reels" | "ad">("posts");

  return (
    <div className="min-h-screen bg-[#07080d] text-white selection:bg-violet-600 selection:text-white">
      {/* ── 1. Top Announcement Banner ─────────────────────────────────── */}
      <div className="bg-gradient-to-r from-violet-900 via-fuchsia-900 to-indigo-900 px-4 py-2 text-center text-xs text-violet-200 border-b border-violet-700/40 flex items-center justify-center gap-2">
        <span className="px-2 py-0.5 rounded-full bg-white/20 text-white font-bold text-[10px] uppercase">Official Deployra Product</span>
        <span>Developed & Maintained by <strong>Deployra Private Limited</strong> (<a href="https://deployra.in" target="_blank" rel="noreferrer" className="underline hover:text-white">deployra.in</a>)</span>
        <ArrowRight size={12} className="inline ml-1" />
      </div>

      {/* ── 2. Navigation Header ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-[#07080d]/85 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-600 flex items-center justify-center text-white shadow-lg shadow-violet-600/30 group-hover:scale-105 transition-transform">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black tracking-tight text-white">Deployra CreatorAI</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-bold border border-violet-500/30">PRO</span>
              </div>
              <p className="text-[10px] text-gray-400">By Deployra Private Limited (deployra.in)</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-gray-300">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#copilot" className="hover:text-white transition-colors flex items-center gap-1">
              <Bot size={13} className="text-violet-400" /> Claude Copilot
            </a>
            <a href="#pricing" className="hover:text-white transition-colors">Plans & Pricing</a>
            <a href="#contact" className="hover:text-white transition-colors">Contact</a>
          </nav>

          {/* Right Action CTAs */}
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="px-4 py-2 rounded-xl text-xs font-bold text-gray-300 hover:text-white hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 transition-all shadow-lg shadow-violet-600/30 flex items-center gap-1.5"
            >
              <Rocket size={14} /> Get Started Free
            </Link>
          </div>
        </div>
      </header>

      {/* ── 3. Hero Section ────────────────────────────────────────────── */}
      <section className="relative pt-16 pb-20 overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-violet-600/20 blur-[130px] rounded-full pointer-events-none -z-10" />
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[250px] bg-fuchsia-600/15 blur-[100px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center space-y-7">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-950/60 border border-violet-500/30 text-violet-300 text-xs font-medium backdrop-blur-md">
            <Bot size={14} className="text-violet-400" />
            <span>Built-in Claude 3.5 Sonnet & Meta Ads API · No Anthropic Keys Required</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-[1.1] max-w-4xl mx-auto">
            One Prompt to Create Videos, Write Posts & Launch <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">Social Ads</span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Stop switching between copywriting tools, video editors, and complicated Meta Ads Manager.
            Give a single prompt—<strong>Deployra CreatorAI</strong> writes your posts, generates viral reel scripts, and deploys high-converting Meta campaigns in 60 seconds.
          </p>

          {/* Dual CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/auth/signup"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 transition-all shadow-xl shadow-violet-600/35 flex items-center justify-center gap-2"
            >
              <Rocket size={16} /> Start Creating Free <ChevronRight size={16} />
            </Link>
            <a
              href="#pricing"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl text-sm font-bold text-gray-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex items-center justify-center gap-2"
            >
              View Plans & Bundles
            </a>
          </div>

          {/* Social Proof Metric Ticker */}
          <div className="pt-8 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto text-center">
            <div>
              <p className="text-2xl font-black text-white">100%</p>
              <p className="text-xs text-gray-400">Zero Direct Claude Fees</p>
            </div>
            <div>
              <p className="text-2xl font-black text-violet-400">1-Click</p>
              <p className="text-xs text-gray-400">Meta & Social Publish</p>
            </div>
            <div>
              <p className="text-2xl font-black text-fuchsia-400">₹10,000</p>
              <p className="text-xs text-gray-400">Monthly All-in-One Pack</p>
            </div>
            <div>
              <p className="text-2xl font-black text-emerald-400">Deployra</p>
              <p className="text-xs text-gray-400">Cloud Infrastructure</p>
            </div>
          </div>
        </div>

        {/* ── Hero Interactive Live Demo Card ───────────────────────────── */}
        <div id="copilot" className="max-w-4xl mx-auto mt-14 px-4 sm:px-6">
          <div className="rounded-2xl bg-black/60 border border-violet-500/30 p-5 sm:p-6 backdrop-blur-xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Bot size={14} className="text-violet-400" /> Claude Copilot Prompt Bar
                </span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 font-medium">
                Live Studio Interface Preview
              </span>
            </div>

            {/* Mock Prompt Box */}
            <div className="bg-[#12131c] rounded-xl p-3 border border-white/5 space-y-2">
              <div className="text-xs text-gray-400 font-mono">User prompt:</div>
              <p className="text-sm text-violet-200 font-medium">
                &ldquo;Create our 1-month growth bundle: 8 engaging Instagram & Facebook posts, 8 high-retention reel scripts for our organic coffee brand, and a 10-day Meta Ads campaign with ₹500 daily budget targeting metro cities.&rdquo;
              </p>
            </div>

            {/* Generated Output Tabs */}
            <div className="space-y-3">
              <div className="flex gap-2 border-b border-white/10 pb-2">
                <button
                  onClick={() => setActiveDemoTab("posts")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    activeDemoTab === "posts" ? "bg-violet-600 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  8 Social Posts Generated
                </button>
                <button
                  onClick={() => setActiveDemoTab("reels")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    activeDemoTab === "reels" ? "bg-violet-600 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  8 Viral Reels & Hooks
                </button>
                <button
                  onClick={() => setActiveDemoTab("ad")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    activeDemoTab === "ad" ? "bg-violet-600 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  Meta Ad Campaign (₹500/day)
                </button>
              </div>

              {activeDemoTab === "posts" && (
                <div className="grid sm:grid-cols-2 gap-3 text-left">
                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-1.5">
                    <span className="text-[10px] font-bold text-violet-300 uppercase">Post #1 · Instagram & FB</span>
                    <h4 className="text-xs font-bold text-white">Morning Brew Perfection</h4>
                    <p className="text-xs text-gray-300 line-clamp-3">
                      Start your day with ethically sourced Arabica beans roasted to chocolatey perfection. No bitterness, pure morning energy. #ArtisanCoffee #DeployraGrowth
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-1.5">
                    <span className="text-[10px] font-bold text-violet-300 uppercase">Post #2 · Instagram & LinkedIn</span>
                    <h4 className="text-xs font-bold text-white">Behind The Roast Process</h4>
                    <p className="text-xs text-gray-300 line-clamp-3">
                      Meet the farmers behind your cup. Our single-origin harvest supports 200+ local farming families across Coorg and Chikmagalur.
                    </p>
                  </div>
                </div>
              )}

              {activeDemoTab === "reels" && (
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 text-left space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-fuchsia-300">Reel #1 · 15 Seconds High Retention</span>
                    <span className="text-[10px] text-gray-400">9:16 Vertical Video</span>
                  </div>
                  <div className="p-2 rounded bg-violet-950/40 border border-violet-500/20 text-xs">
                    <span className="text-violet-400 font-bold block mb-0.5">🔥 Hook (0-3s):</span>
                    &ldquo;Most people ruin their morning coffee in the first 10 seconds—here is the fix.&rdquo;
                  </div>
                  <p className="text-xs text-gray-300">
                    Spoken Voiceover: &ldquo;Pour cold water? Wrong. Using boiling 100°C water burns the roast...&rdquo;
                  </p>
                </div>
              )}

              {activeDemoTab === "ad" && (
                <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-500/20 text-left space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-blue-300">Ready to Launch on Meta Ads</span>
                    <span className="text-[11px] font-semibold text-emerald-400">₹500 / Day (10 Days)</span>
                  </div>
                  <p className="text-xs text-white font-bold">Headline: &ldquo;Freshly Roasted Single-Origin Coffee Delivered Free&rdquo;</p>
                  <p className="text-xs text-gray-300">Audience: Mumbai, Bengaluru, Delhi · Ages 22–45 · CTA: Shop Now / Get Offer</p>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-between text-xs text-gray-400">
              <span>Ready to test your own prompts?</span>
              <Link href="/auth/signup" className="text-violet-400 font-bold hover:text-violet-300 flex items-center gap-1">
                Open Studio Now <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. How It Works (3 Steps) ──────────────────────────────────── */}
      <section id="how-it-works" className="py-20 border-t border-white/10 bg-black/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12 text-center">
          <div className="space-y-2 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-violet-400">Effortless Workflow</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">How Deployra CreatorAI Works</h2>
            <p className="text-sm text-gray-400">From a single prompt to live social posts and paid ad campaigns in 3 simple steps.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 text-left">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4 hover:border-violet-500/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-violet-600/20 text-violet-400 flex items-center justify-center font-black text-lg">
                1
              </div>
              <h3 className="text-lg font-bold text-white">Describe Your Goal</h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                Type what you need in plain English. For example: <em>&ldquo;Create 8 posts and reels for our new fitness bootcamp and run an ad campaign for leads.&rdquo;</em>
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4 hover:border-violet-500/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-fuchsia-600/20 text-fuchsia-400 flex items-center justify-center font-black text-lg">
                2
              </div>
              <h3 className="text-lg font-bold text-white">Claude AI Architects It</h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                Our backend Claude 3.5 Sonnet engine writes custom copy, generates visual prompts, crafts viral reel hooks, and selects optimal Meta ad targeting.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4 hover:border-violet-500/40 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-black text-lg">
                3
              </div>
              <h3 className="text-lg font-bold text-white">1-Click Publish & Launch</h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                Schedule posts to your connected Instagram, Facebook & LinkedIn pages, or deploy your ad campaign directly to Meta Ads Manager in a single click.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Product Features Suite ───────────────────────────────────── */}
      <section id="features" className="py-20 border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-fuchsia-400">Comprehensive Suite</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">Everything Your Business Needs to Grow</h2>
            <p className="text-sm text-gray-400">All tools included under one unified subscription by Deployra.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center">
                <Bot size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Claude Studio Copilot</h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                Access Claude 3.5 Sonnet directly through our platform. Zero Anthropic keys required—just prompt and execute.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-fuchsia-500/20 text-fuchsia-400 flex items-center justify-center">
                <Video size={20} />
              </div>
              <h3 className="text-base font-bold text-white">AI Video & Reel Studio</h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                Render viral 15s/30s short-form videos with hook scripts, voiceover narration, and Kling AI visual models.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Megaphone size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Meta & Google Ads Launcher</h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                Launch awareness, website traffic, app install, or lead campaigns directly to Meta Ads Manager with safe paused review.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Layers size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Publishing Hub & Calendar</h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                Auto-publish organic posts directly to your Facebook Pages, Instagram Business, LinkedIn Profiles, and YouTube.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Users size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Lead CRM & AI Qualification</h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                Capture incoming ad enquiries, score lead quality with AI, and trigger instant WhatsApp or email follow-ups.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <ShieldCheck size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Deployra Cloud Infrastructure</h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                Enterprise data isolation, atomic credit ledger, bank-grade encryption, and 99.9% uptime backed by Deployra.in.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. Plans & Pricing Section ─────────────────────────────────── */}
      <section id="pricing" className="py-20 border-t border-white/10 bg-black/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-violet-400">Transparent Pricing</span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">Choose the Model that Fits You Best</h2>
            <p className="text-sm text-gray-400">
              Pay for software only (if you already have a Meta account), or pick an All-Inclusive Done-For-You Bundle where you pay once.
            </p>

            {/* Mode Switcher Toggle */}
            <div className="inline-flex p-1 rounded-xl bg-white/5 border border-white/10 mt-2">
              <button
                onClick={() => setBillingMode("managed")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  billingMode === "managed"
                    ? "bg-violet-600 text-white shadow-md"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                🚀 All-Inclusive Bundles (Pay Once in Wallet)
              </button>
              <button
                onClick={() => setBillingMode("software")}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  billingMode === "software"
                    ? "bg-violet-600 text-white shadow-md"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                🛠️ Software Only (You Pay Meta Directly)
              </button>
            </div>
          </div>

          {/* Mode 1: All-Inclusive Managed Bundles */}
          {billingMode === "managed" && (
            <div className="grid md:grid-cols-3 gap-6 animate-fadeIn">
              {/* Plan 1 */}
              <div className="p-6 rounded-2xl bg-white/5 border border-violet-500/40 relative flex flex-col justify-between shadow-xl shadow-violet-950/20">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[11px] font-bold bg-violet-600 text-white shadow">
                  Most Popular For SMBs
                </div>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-violet-300">Monthly Growth Pack</h3>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-3xl font-black text-white">₹10,000</span>
                      <span className="text-xs text-gray-400">/ month</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Full-service hands-off content & 10-day Meta ad campaign.</p>
                  </div>

                  <ul className="space-y-2 text-xs text-gray-300 border-t border-white/10 pt-4">
                    <li className="flex items-center gap-2"><Check size={14} className="text-violet-400" /> 8 Custom Social Media Posts (IG, FB, LinkedIn)</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-violet-400" /> 8 Viral Video Reel Scripts & Hooks</li>
                    <li className="flex items-center gap-2 font-semibold text-emerald-300"><Check size={14} className="text-emerald-400" /> ₹5,000 Meta Ad Spend included (₹500/day)</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-violet-400" /> 10-Day Brand Awareness / Leads Campaign</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-violet-400" /> 20,000 AI Platform Tokens</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-violet-400" /> Zero Meta setup required by client</li>
                  </ul>
                </div>
                <Link href="/auth/signup" className="btn-primary w-full justify-center py-2.5 text-xs font-bold mt-6">
                  Get Started with ₹10k Pack
                </Link>
              </div>

              {/* Plan 2 */}
              <div className="p-6 rounded-2xl bg-white/5 border border-blue-500/40 flex flex-col justify-between">
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">Website Traffic</span>
                    <h3 className="text-base font-bold text-blue-300 mt-2">Clickable & Traffic Plan</h3>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-3xl font-black text-white">₹15,000</span>
                      <span className="text-xs text-gray-400">/ month</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Engineered to drive qualified visitors & store purchases.</p>
                  </div>

                  <ul className="space-y-2 text-xs text-gray-300 border-t border-white/10 pt-4">
                    <li className="flex items-center gap-2"><Check size={14} className="text-blue-400" /> 15 High-converting Social Posts with CTA</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-blue-400" /> 10 Video Reels with Link-in-Bio hooks</li>
                    <li className="flex items-center gap-2 font-semibold text-emerald-300"><Check size={14} className="text-emerald-400" /> ₹7,500 Meta Ad Spend included</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-blue-400" /> High-CTR Clickable Ads Setup</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-blue-400" /> Pixel & UTM Conversion Tracking</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-blue-400" /> 35,000 AI Platform Tokens</li>
                  </ul>
                </div>
                <Link href="/auth/signup" className="btn-secondary w-full justify-center py-2.5 text-xs font-bold mt-6">
                  Choose Traffic Plan
                </Link>
              </div>

              {/* Plan 3 */}
              <div className="p-6 rounded-2xl bg-white/5 border border-fuchsia-500/40 flex flex-col justify-between">
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300">Mobile Apps</span>
                    <h3 className="text-base font-bold text-fuchsia-300 mt-2">App Download & Install Plan</h3>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-3xl font-black text-white">₹25,000</span>
                      <span className="text-xs text-gray-400">/ month</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Dedicated to driving iOS & Android verified installs.</p>
                  </div>

                  <ul className="space-y-2 text-xs text-gray-300 border-t border-white/10 pt-4">
                    <li className="flex items-center gap-2"><Check size={14} className="text-fuchsia-400" /> 20 App Promo Posts + 15 Viral Reels</li>
                    <li className="flex items-center gap-2 font-semibold text-emerald-300"><Check size={14} className="text-emerald-400" /> ₹12,000 Meta Ad Spend included</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-fuchsia-400" /> App Store & Play Store Deep Linking</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-fuchsia-400" /> Cost-Per-Install (CPI) Optimization</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-fuchsia-400" /> 60,000 AI Platform Tokens</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-fuchsia-400" /> Dedicated Growth Strategy Support</li>
                  </ul>
                </div>
                <Link href="/auth/signup" className="btn-secondary w-full justify-center py-2.5 text-xs font-bold mt-6">
                  Choose App Install Plan
                </Link>
              </div>
            </div>
          )}

          {/* Mode 2: Software Only Plans */}
          {billingMode === "software" && (
            <div className="grid md:grid-cols-3 gap-6 animate-fadeIn">
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                <div className="space-y-3">
                  <h3 className="text-base font-bold text-gray-200">Apprentice</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-white">₹999</span>
                    <span className="text-xs text-gray-400">/ month</span>
                  </div>
                  <p className="text-xs text-gray-400">For creators managing their own cards on Meta.</p>
                  <ul className="space-y-2 text-xs text-gray-300 border-t border-white/10 pt-4">
                    <li className="flex items-center gap-2"><Check size={14} className="text-gray-400" /> 8,500 credits / month</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-gray-400" /> Claude Copilot Prompt access</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-gray-400" /> 1-Click Meta Campaign builder</li>
                    <li className="flex items-center gap-2 text-violet-300"><Check size={14} /> You pay Meta directly on your card</li>
                  </ul>
                </div>
                <Link href="/auth/signup" className="btn-secondary w-full justify-center py-2.5 text-xs font-bold mt-6">
                  Subscribe Apprentice
                </Link>
              </div>

              <div className="p-6 rounded-2xl bg-white/5 border border-violet-500/40 relative flex flex-col justify-between">
                <div className="space-y-3">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-500/20 text-violet-300">Creator Favorite</span>
                  <h3 className="text-base font-bold text-violet-300">Artisan Pro</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-white">₹1,999</span>
                    <span className="text-xs text-gray-400">/ month</span>
                  </div>
                  <p className="text-xs text-gray-400">For active businesses & studios.</p>
                  <ul className="space-y-2 text-xs text-gray-300 border-t border-white/10 pt-4">
                    <li className="flex items-center gap-2"><Check size={14} className="text-violet-400" /> 25,000 credits / month</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-violet-400" /> Video Reels (Kling AI model)</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-violet-400" /> Auto-publishing to IG & FB</li>
                    <li className="flex items-center gap-2 text-violet-300"><Check size={14} /> You pay Meta directly on your card</li>
                  </ul>
                </div>
                <Link href="/auth/signup" className="btn-primary w-full justify-center py-2.5 text-xs font-bold mt-6">
                  Subscribe Artisan
                </Link>
              </div>

              <div className="p-6 rounded-2xl bg-white/5 border border-amber-500/40 flex flex-col justify-between">
                <div className="space-y-3">
                  <h3 className="text-base font-bold text-amber-300">Maestro Agency</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-white">₹3,999</span>
                    <span className="text-xs text-gray-400">/ month</span>
                  </div>
                  <p className="text-xs text-gray-400">For agencies managing client accounts.</p>
                  <ul className="space-y-2 text-xs text-gray-300 border-t border-white/10 pt-4">
                    <li className="flex items-center gap-2"><Check size={14} className="text-amber-400" /> 60,000 credits / month</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-amber-400" /> Multi-brand workspace & White-label</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-amber-400" /> Dedicated priority generation queue</li>
                    <li className="flex items-center gap-2 text-violet-300"><Check size={14} /> You pay Meta directly on your card</li>
                  </ul>
                </div>
                <Link href="/auth/signup" className="btn-secondary w-full justify-center py-2.5 text-xs font-bold mt-6">
                  Subscribe Maestro
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── 7. Deployra Trust & Contact Section ─────────────────────────── */}
      <section id="contact" className="py-20 border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="rounded-3xl p-8 sm:p-12 bg-gradient-to-br from-violet-950/40 via-black to-[#0e0f18] border border-violet-500/25 grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/20 text-violet-300 text-xs font-bold border border-violet-500/30">
                <Globe size={13} /> Developed by Deployra (deployra.in)
              </div>
              <h2 className="text-3xl font-black text-white">Backed by Deployra Private Limited</h2>
              <p className="text-xs text-gray-300 leading-relaxed">
                Deployra is an Indian technology company specializing in modern developer cloud platforms, DevOps automation, and enterprise AI tools. Deployra CreatorAI is built with bank-grade reliability, secure credit accounting, and direct Meta API compliance.
              </p>

              <div className="space-y-2 text-xs text-gray-300 pt-2">
                <div className="flex items-center gap-2.5">
                  <Globe size={15} className="text-violet-400 shrink-0" />
                  <span>Official Website: <a href="https://deployra.in" target="_blank" rel="noreferrer" className="text-violet-300 hover:underline font-bold">deployra.in</a></span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Mail size={15} className="text-violet-400 shrink-0" />
                  <span>Email: <a href="mailto:support@deployra.in" className="text-violet-300 hover:underline">support@deployra.in</a> / <a href="mailto:contact@deployra.in" className="text-violet-300 hover:underline">contact@deployra.in</a></span>
                </div>
                <div className="flex items-center gap-2.5">
                  <MapPin size={15} className="text-violet-400 shrink-0" />
                  <span>Corporate Office: Nashik, Maharashtra, India</span>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-black/40 border border-white/10 space-y-4 text-center sm:text-left">
              <h3 className="text-base font-bold text-white">Have questions before starting?</h3>
              <p className="text-xs text-gray-400">
                Our growth specialists can walk you through the ₹10,000 monthly bundle or connect your Meta accounts live.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <a
                  href="mailto:contact@deployra.in?subject=CreatorAI%20Inquiry"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Mail size={14} /> Email Us
                </a>
                <Link
                  href="/auth/signup"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-gray-200 bg-white/10 hover:bg-white/15 transition-colors flex items-center justify-center gap-1.5"
                >
                  Create Free Account
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. Comprehensive Footer ────────────────────────────────────── */}
      <footer className="border-t border-white/10 bg-[#05060a] py-12 text-xs text-gray-400">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-white">
                <Sparkles size={14} />
              </div>
              <span className="font-bold text-white text-sm">Deployra CreatorAI Studio</span>
            </div>

            <div className="flex items-center gap-6 text-xs">
              <Link href="/terms" className="hover:text-white transition-colors">Terms & Conditions</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <a href="https://deployra.in" target="_blank" rel="noreferrer" className="hover:text-white transition-colors flex items-center gap-1">
                deployra.in <ExternalLink size={11} />
              </a>
              <Link href="/auth/login" className="text-violet-400 font-bold hover:text-white transition-colors">
                Studio Login
              </Link>
            </div>
          </div>

          <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 text-gray-500 text-[11px]">
            <p>© {new Date().getFullYear()} Deployra Private Limited. All rights reserved.</p>
            <p>Developed with pride by Deployra · Cloud Infrastructure & AI Marketing Systems</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
