import Stripe from "stripe";

export function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  return !!key && key !== "your_stripe_secret_key";
}

export function getStripeClient(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY as string);
}

export const PLAN_BY_PRICE_ID: Record<string, "apprentice" | "artisan" | "maestro"> = {
  [process.env.STRIPE_APPRENTICE_PRICE_ID ?? ""]: "apprentice",
  [process.env.STRIPE_ARTISAN_PRICE_ID ?? ""]: "artisan",
  [process.env.STRIPE_MAESTRO_PRICE_ID ?? ""]: "maestro",
};

// One-time credit packs (a wallet recharge, not a subscription). These use
// Stripe Checkout's `payment` mode with inline price_data, so they need no
// pre-created Stripe Price objects — the only server secret required is
// STRIPE_SECRET_KEY. `credits` is what actually lands in the user's balance;
// `bonus` is display-only. `priceId` is the one-time Price created here, so
// amount stays authoritative server-side (never trust a client-sent price).
export interface CreditPack {
  id: string;
  credits: number;
  /** Display bonus %, e.g. 10 → "+10% bonus". */
  bonus: number;
  /** Amount in the smallest currency unit (cents). */
  amountCents: number;
  currency: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "pack-1k", credits: 1000, bonus: 0, amountCents: 500, currency: "usd" },
  { id: "pack-5k", credits: 5000, bonus: 10, amountCents: 2000, currency: "usd" },
  { id: "pack-15k", credits: 15000, bonus: 20, amountCents: 5000, currency: "usd" },
  { id: "pack-50k", credits: 50000, bonus: 30, amountCents: 15000, currency: "usd" },
];

export function findCreditPack(id: string | undefined): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}
