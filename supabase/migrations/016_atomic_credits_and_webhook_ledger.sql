-- Production-hardening migration. Three things the audit flagged:
--
--   1. Credit deduction was a read-then-write race in every generation route
--      (`update credits = creditsBefore - cost`), so two concurrent requests
--      could both pass the balance check and double-spend. The RPCs below do
--      the check-and-deduct in a single atomic statement.
--   2. One-time credit top-up (recharging a wallet) had no way to add credits
--      safely alongside live spending — `add_credits` is the atomic increment.
--   3. The Stripe webhook wasn't idempotent: a redelivered
--      `checkout.session.completed` would grant credits twice. Stripe retries
--      webhooks and can deliver duplicates at-least-once by design, so we
--      record processed event ids and skip anything already handled.
--
-- SECURITY: these are SECURITY DEFINER and locked to the service_role key.
-- They must never be exposed to anon/authenticated — balance changes only
-- happen server-side via the service-role client (see src/lib/supabase/admin.ts).

-- ── 1. Atomic spend (fails if balance insufficient) ──────────────────────────
create or replace function public.spend_credits(p_user_id uuid, p_amount integer)
returns table (success boolean, credits_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  bal integer;
begin
  if p_amount is null or p_amount <= 0 then
    return query select true, p.credits from public.profiles p where p.id = p_user_id;
    return;
  end if;

  update public.profiles
     set credits = credits - p_amount
   where id = p_user_id
     and credits >= p_amount
  returning credits into bal;

  if bal is null then
    return query select false, coalesce((select credits from public.profiles where id = p_user_id), 0);
  else
    return query select true, bal;
  end if;
end;
$$;

-- ── 2. Atomic add (wallet recharge / plan grant / refund) ────────────────────
create or replace function public.add_credits(p_user_id uuid, p_amount integer)
returns table (success boolean, credits_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  bal integer;
begin
  if p_amount is null or p_amount <= 0 then
    return query select true, p.credits from public.profiles p where p.id = p_user_id;
    return;
  end if;

  update public.profiles
     set credits = credits + p_amount
   where id = p_user_id
  returning credits into bal;

  return query select (bal is not null), coalesce(bal, 0);
end;
$$;

-- Lock both to service_role only (revoke even from authenticated/anon).
revoke execute on function public.spend_credits(uuid, integer) from public, anon, authenticated;
revoke execute on function public.add_credits(uuid, integer) from public, anon, authenticated;
grant execute on function public.spend_credits(uuid, integer) to service_role;
grant execute on function public.add_credits(uuid, integer) to service_role;

-- ── 3. Stripe webhook idempotency ledger ─────────────────────────────────────
create table if not exists public.processed_stripe_events (
  event_id    text primary key,
  event_type  text not null,
  processed_at timestamptz not null default now()
);
alter table public.processed_stripe_events enable row level security;
-- No policies: only the service-role client (which bypasses RLS) touches this
-- ledger, so anon/authenticated get zero access by construction.
