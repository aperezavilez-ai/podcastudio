-- Admin: en Supabase Dashboard → Authentication → Users → usuario → App Metadata → {"role": "admin"}
-- El rol se lee en el cliente vía mapSupabaseUser (app_metadata.role).
-- Seguro para volver a ejecutar: usa DROP POLICY IF EXISTS antes de cada política.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  data jsonb not null default '{}',
  updated_at timestamptz default now()
);

alter table public.projects enable row level security;

drop policy if exists "Users manage own projects" on public.projects;
create policy "Users manage own projects"
  on public.projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Suscripciones Stripe (webhook escribe con service role)
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_id text not null,
  status text not null default 'active',
  stripe_customer_id text,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  updated_at timestamptz default now()
);

create index if not exists subscriptions_stripe_customer_idx
  on public.subscriptions (stripe_customer_id);

alter table public.subscriptions enable row level security;

drop policy if exists "Users read own subscription" on public.subscriptions;
create policy "Users read own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Grabaciones en Mux (+ publicación YouTube)
create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text,
  file_name text,
  duration_sec int,
  mux_upload_id text,
  mux_asset_id text,
  mux_playback_id text,
  youtube_video_id text,
  status text not null default 'uploading',
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists recordings_user_idx on public.recordings (user_id, created_at desc);

alter table public.recordings enable row level security;

drop policy if exists "Users read own recordings" on public.recordings;
create policy "Users read own recordings"
  on public.recordings for select
  using (auth.uid() = user_id);

-- Conexión OAuth YouTube (solo servidor escribe)
create table if not exists public.youtube_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  channel_id text,
  channel_title text,
  refresh_token text not null,
  access_token text,
  token_expires_at timestamptz,
  updated_at timestamptz default now()
);

alter table public.youtube_connections enable row level security;

drop policy if exists "Users read own youtube" on public.youtube_connections;
create policy "Users read own youtube"
  on public.youtube_connections for select
  using (auth.uid() = user_id);

-- Sesiones en vivo (Livepeer + Restream)
create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  livepeer_stream_id text,
  restream_event_id text,
  title text,
  status text default 'active',
  created_at timestamptz default now()
);

alter table public.live_sessions enable row level security;

drop policy if exists "Users read own live sessions" on public.live_sessions;
create policy "Users read own live sessions"
  on public.live_sessions for select
  using (auth.uid() = user_id);
