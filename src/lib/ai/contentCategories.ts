export interface ContentCategory {
  id: string;
  label: string;
  description: string;
  /** Injected into the scene-script system prompt to steer structure/tone for this format. */
  promptHint: string;
}

export const CONTENT_CATEGORIES: ContentCategory[] = [
  { id: "general", label: "General / Custom", description: "No fixed structure — follows your topic naturally", promptHint: "No special structural convention — follow the topic naturally." },
  { id: "product_showcase", label: "Product Showcase", description: "Clean, feature-by-feature product highlight", promptHint: "Open on a hook about the problem, dedicate the middle scenes to clean, well-lit product shots highlighting one key feature at a time, close on a clear CTA." },
  { id: "unboxing", label: "Unboxing", description: "Opening the box, first reaction, detail shots", promptHint: "Structure as an unboxing: anticipation/hook, opening the packaging, first reaction, close-up detail shots of the product, final shot of it in use." },
  { id: "before_after", label: "Before & After", description: "Problem state, transition, satisfying reveal", promptHint: "Open with the 'before' problem state, show a transition moment, then clearly reveal the 'after' result — contrast is the whole point." },
  { id: "problem_solution", label: "Problem → Solution", description: "Pain point, agitation, the fix, CTA", promptHint: "Open with a relatable pain point stated directly to camera, briefly agitate it, introduce the product as the fix, end with a clear CTA." },
  { id: "testimonial", label: "Customer Testimonial", description: "Genuine-sounding first-person review", promptHint: "Structure as a customer testimonial — presenter speaks as if sharing their own genuine experience, specific details over generic praise, no stage-y sales language." },
  { id: "ugc", label: "UGC / Authentic Style", description: "Casual, handheld, friend-recommending-it tone", promptHint: "Casual, handheld, authentic UGC style — presenter talks like a friend recommending something, not a brand. Looser dialogue, less polished claims." },
  { id: "bts", label: "Behind-the-Scenes", description: "Process/making-of, documentary feel", promptHint: "Behind-the-scenes feel — show the process or making-of, presenter narrates candidly, more documentary than scripted ad." },
  { id: "howto", label: "How-To / Tutorial", description: "Clear step-by-step demonstration", promptHint: "Structure as a clear step-by-step tutorial — sequential steps, presenter explains each step while demonstrating." },
  { id: "day_in_life", label: "Day-in-the-Life", description: "Product woven into a relatable routine", promptHint: "Frame around a relatable daily routine or moment, with the product appearing naturally within that lifestyle context rather than as the sole focus." },
  { id: "comparison", label: "Comparison (Us vs. Them)", description: "Old way vs. new way, direct contrast", promptHint: "Structure as a direct comparison — old way vs. new way, or this vs. a generic alternative — contrast benefits clearly without naming real competitors." },
  { id: "trending_transition", label: "Trending Transition Reel", description: "Fast cuts, energetic, trend-style pacing", promptHint: "Fast-paced, short scenes built for a trending transition/cut style — quick hook, rapid cuts, energetic pacing, minimal dialogue per scene." },
  { id: "flash_sale", label: "Flash Sale / Promo", description: "Urgency, discount, time pressure", promptHint: "Urgency-driven — lead with the offer/discount, create time pressure, end with a strong, specific CTA (code, deadline, link)." },
  { id: "launch_teaser", label: "Launch Teaser / Countdown", description: "Build anticipation without a full reveal", promptHint: "Build anticipation for something not yet available — tease without fully revealing, end on a 'coming soon' / countdown CTA." },
  { id: "social_proof", label: "Social Proof / Stats", description: "Lead with numbers, reviews, results", promptHint: "Lead with numbers/stats/results (reviews, customers served, ratings) stated confidently, product shown as the reason for those results." },
  { id: "founder_story", label: "Founder / Brand Story", description: "Personal, first-person origin story", promptHint: "Personal, first-person founder narrative — why this was built, what problem it solves, authentic and vulnerable tone over a sales pitch." },
  { id: "pov", label: "POV Reel", description: "Second-person, \"you are living this\" style", promptHint: "Shot and written in second-person 'POV' style — camera and dialogue address the viewer as if they are living the moment themselves." },
  { id: "myth_fact", label: "Myth vs. Fact", description: "Bust a misconception, back it up", promptHint: "Structure as myth-busting — state a common misconception, clearly correct it, back it up, land on the product as the proof point." },
  { id: "direct_response", label: "Direct-Response Ad", description: "Hard CTA, explicit urgency, no fluff", promptHint: "Hard, clear direct-response ad structure — fast hook, concrete benefit claims, explicit strong CTA with urgency, no soft branding fluff." },
];

export function getContentCategory(id: string | undefined): ContentCategory {
  return CONTENT_CATEGORIES.find((c) => c.id === id) ?? CONTENT_CATEGORIES[0];
}
