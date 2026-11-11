-- A paired staff phone can preview its counter even when there is no display window.
-- Business repositories may remain local; this is independent device transport.
alter table app_private.terminals add column display_snapshot jsonb, add column display_updated_at timestamptz;
