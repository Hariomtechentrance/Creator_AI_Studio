import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Atomic credit balance changes, run through the service-role client only.
 *
 * Both wrap SECURITY DEFINER Postgres functions (see migration 016) that do the
 * read-check-write in a single statement, so concurrent requests can no longer
 * double-spend or lose a top-up the way the old `update({ credits: before - cost })`
 * read-then-write did. Requires migration 016 to be applied before these routes go live.
 */
type Admin = SupabaseClient<Database>;

function firstRow(data: unknown): { success: boolean; credits_after: number } | undefined {
  const row = Array.isArray(data) ? data[0] : data;
  return row as { success: boolean; credits_after: number } | undefined;
}

/** Deducts `amount` credits iff the balance covers it. Returns false if insufficient. */
export async function spendCredits(admin: Admin, userId: string, amount: number): Promise<boolean> {
  const { data, error } = await admin.rpc("spend_credits", { p_user_id: userId, p_amount: amount });
  if (error) throw error;
  return !!firstRow(data)?.success;
}

/** Adds `amount` credits (wallet recharge, plan grant, or refund). */
export async function addCredits(admin: Admin, userId: string, amount: number): Promise<boolean> {
  const { data, error } = await admin.rpc("add_credits", { p_user_id: userId, p_amount: amount });
  if (error) throw error;
  return !!firstRow(data)?.success;
}
