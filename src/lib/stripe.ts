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
