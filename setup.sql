-- 1. Create table for User Statistics (Safe if exists)
create table if not exists public.user_stats (
  id uuid references auth.users on delete cascade not null primary key,
  scan_count int default 0,
  is_premium boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Enable Row Level Security (RLS)
alter table public.user_stats enable row level security;

-- 3. Policy: Users can view their own stats
-- FIX: Drop policy first to avoid "already exists" error
drop policy if exists "Users can view their own stats" on public.user_stats;
create policy "Users can view their own stats"
  on public.user_stats for select
  using ( auth.uid() = id );

-- 4. Create table for Reports
create table if not exists public.reports (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete set null,
  original_text text,
  ai_result jsonb,
  user_correction text,
  user_notes text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 5. Enable RLS for reports
alter table public.reports enable row level security;

-- 6. Policy: Insert reports
-- FIX: Drop policy first
drop policy if exists "Anyone can insert reports" on public.reports;
create policy "Anyone can insert reports"
  on public.reports for insert
  with check ( true );

-- 7. Function to handle new user creation automatically
create or replace function public.handle_new_user()
returns trigger as $$
begin
  -- Use ON CONFLICT to avoid errors if row already exists
  insert into public.user_stats (id, scan_count, is_premium)
  values (new.id, 0, false)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- 8. Trigger to call the above function on sign up
-- FIX: Drop trigger first
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 9. RPC Function: Increment Scan Count safely
create or replace function increment_scan_count(row_id uuid)
returns void as $$
begin
  insert into public.user_stats (id, scan_count)
  values (row_id, 1)
  on conflict (id)
  do update set scan_count = user_stats.scan_count + 1;
end;
$$ language plpgsql security definer;