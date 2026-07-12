-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  credits integer not null default 150,
  plan text not null default 'free' check (plan in ('free','apprentice','artisan','maestro')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Generations table
create table public.generations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in ('image','video','upscale','texture')),
  prompt text not null,
  model text not null,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  output_urls text[] not null default '{}',
  settings jsonb not null default '{}',
  credits_used integer not null default 0,
  created_at timestamptz not null default now()
);

-- Trained models table
create table public.trained_models (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text,
  trigger_word text not null,
  replicate_model_id text,
  status text not null default 'training' check (status in ('training','ready','failed')),
  thumbnail_url text,
  created_at timestamptz not null default now()
);

-- Credit transactions table
create table public.credit_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount integer not null,
  type text not null check (type in ('earned','spent','purchased','refunded')),
  description text not null,
  created_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  -- Give new user their welcome credits transaction record
  insert into public.credit_transactions (user_id, amount, type, description)
  values (new.id, 150, 'earned', 'Welcome bonus — free credits');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles
  for each row execute procedure update_updated_at();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.generations enable row level security;
alter table public.trained_models enable row level security;
alter table public.credit_transactions enable row level security;

create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can view own generations" on public.generations for all using (auth.uid() = user_id);
create policy "Users can view own models" on public.trained_models for all using (auth.uid() = user_id);
create policy "Users can view own transactions" on public.credit_transactions for select using (auth.uid() = user_id);
