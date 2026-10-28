-- Multiple accounts can be connected per platform (e.g. two Facebook Pages).
-- Publishing previously picked whichever row came back first from the
-- database — nondeterministic, could silently post to the wrong Page.
-- is_default lets the user pick which connected account publishing should
-- use when more than one exists for the same platform.
alter table social_accounts add column if not exists is_default boolean not null default false;

-- Where exactly one account already exists per org+platform, mark it default
-- so existing single-account setups keep working with no action needed.
update social_accounts sa
set is_default = true
where not exists (
  select 1 from social_accounts sa2
  where sa2.org_id = sa.org_id and sa2.platform = sa.platform and sa2.id <> sa.id
);
