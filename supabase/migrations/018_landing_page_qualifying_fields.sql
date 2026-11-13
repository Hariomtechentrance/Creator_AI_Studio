-- Per-page qualifying questions (e.g. "Dealership name", "Cars sold per month")
-- shown after the standard Name/Phone/City fields. Stored as an array of
-- {key, label, type: "text"|"select", options?: string[]}. Answers land in
-- leads.custom_fields, which already exists for exactly this purpose.
alter table landing_pages add column if not exists qualifying_fields jsonb default '[]'::jsonb;
