-- Legacy: perk plans saved like the other builds (a link into the Legacy planner), and the Legacy Challenges each person
-- ticked, kept with the account so every browser shows the same progress.
alter table gr_build drop constraint if exists gr_build_kind_check;
alter table gr_build add constraint gr_build_kind_check check (kind in ('talents', 'gear', 'raid', 'legacy'));

create table if not exists gr_legacy (
  user_id text primary key references "user" ("id") on delete cascade,
  done text[] not null default '{}' check (cardinality(done) <= 200),
  updated_at timestamptz not null default now()
);
