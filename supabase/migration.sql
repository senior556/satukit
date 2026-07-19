-- SatuKit schema (TRD §4). Run in Supabase → SQL Editor → New query → Run.

create table products (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'draft' check (status in ('draft','published')),
  language text not null default 'ru' check (language in ('ru','kk')),
  product_name text not null,
  facts text,
  region text,
  price_minor integer,
  cost_minor integer,
  margin_percent numeric,
  whatsapp_e164 text,
  image_url text not null,
  generated_output jsonb not null,
  confirmed_claims jsonb not null default '[]',
  public_slug text unique,
  edit_token uuid not null default gen_random_uuid(),
  published_at timestamptz,
  model_name text,
  prompt_version text not null default 'v1'
);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  product_id uuid references products(id),
  business_type text,
  region text,
  currently_selling boolean,
  ease_rating integer check (ease_rating between 1 and 5),
  usefulness_rating integer check (usefulness_rating between 1 and 5),
  most_useful text,
  requested_improvement text,
  asset_used boolean,
  evidence_consent boolean not null default false
);

create table events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id uuid,
  product_id uuid,
  event_name text not null,
  metadata jsonb
);

alter table products enable row level security;
alter table feedback enable row level security;
alter table events  enable row level security;
-- no policies: anon access denied; server uses the service role (bypasses RLS).

-- Storage bucket (or create in dashboard → Storage → New bucket → name 'product-images', Public):
insert into storage.buckets (id, name, public) values ('product-images','product-images', true)
on conflict (id) do nothing;
