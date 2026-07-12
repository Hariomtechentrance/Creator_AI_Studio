-- A/B testing for landing pages: one jsonb column holding the variant B
-- copy + view/conversion counters, rather than a second table — this is
-- inherently a single small config+stats blob per page, not a relation.
alter table landing_pages add column if not exists ab_test jsonb default '{"enabled": false}';

-- Public visitors (unauthenticated, no RLS session) increment view/conversion
-- counters via this security-definer function rather than a raw client-side
-- update, both to bypass RLS safely (scoped to exactly one counter) and to
-- avoid a read-modify-write race between concurrent visitors.
create or replace function increment_ab_stat(p_page_id uuid, p_variant text, p_kind text)
returns void language plpgsql security definer as $$
begin
  if p_variant not in ('a', 'b') or p_kind not in ('views', 'conversions') then
    return;
  end if;

  update landing_pages
  set ab_test = jsonb_set(
    coalesce(ab_test, '{"enabled": false}'::jsonb),
    array['stats', p_variant, p_kind],
    to_jsonb(coalesce((ab_test #>> array['stats', p_variant, p_kind])::int, 0) + 1)
  )
  where id = p_page_id;
end;
$$;

