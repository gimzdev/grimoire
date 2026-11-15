-- Saved builds: the specs and builds each person saved. A build is a link into one of the planners (talent calculator,
-- gear planner, raid composer) that carries everything the planner shows, plus the name it was saved under.
-- The same link is kept once per person: saving it again only moves it to the top.
create table if not exists gr_build (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{12}$'),
  user_id text not null references "user" ("id") on delete cascade,
  kind text not null check (kind in ('talents', 'gear', 'raid')),
  name text not null check (char_length(name) between 1 and 80),
  path text not null check (char_length(path) between 2 and 1200 and left(path, 1) = '/'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, path)
);
create index if not exists gr_build_user_idx on gr_build (user_id, updated_at desc);

-- Rate-limit counters, under salted hashes: no address or email is kept readable.
create table if not exists gr_throttle (key text primary key, hits integer not null, started_at timestamptz not null default now());
create index if not exists gr_throttle_started_idx on gr_throttle (started_at);

-- Older versions recorded this file under an earlier name: that record goes, so the list of applied changes matches db/.
delete from gr_migrations where name like '002\_%' and name <> '002_builds.sql';
