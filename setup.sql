-- 1. Create table for User Statistics (Scan count & Premium status)
create table if not exists public.user_stats (
  id uuid references auth.users on delete cascade not null primary key,
  scan_count int default 0,
  is_premium boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Enable Row Level Security (RLS) for user_stats
alter table public.user_stats enable row level security;

-- 3. Policy: Users can only view their own stats
create policy "Users can view their own stats"
  on public.user_stats for select
  using ( auth.uid() = id );

-- 4. Policy: Only Service Role can update stats (prevent users from hacking their count)
-- Note: We don't add an UPDATE policy for users here, so they can't change it via client API.
-- Updates happen via the 'increment_scan_count' function below.

-- 5. Create table for User Reports (Corrections)
create table if not exists public.reports (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete set null,
  original_text text,
  ai_result jsonb,
  user_correction text,
  user_notes text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 6. Enable RLS for reports
alter table public.reports enable row level security;

-- 7. Policy: Authenticated users (and anon) can insert reports
create policy "Anyone can insert reports"
  on public.reports for insert
  with check ( true );

-- 8. Function to handle new user creation automatically
-- This ensures a row exists in user_stats whenever a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_stats (id, scan_count, is_premium)
  values (new.id, 0, false);
  return new;
end;
$$ language plpgsql security definer;

-- 9. Trigger to call the above function on sign up
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 10. RPC Function: Increment Scan Count safely
-- This is called by the backend/client to increase the count without direct table access
create or replace function increment_scan_count(row_id uuid)
returns void as $$
begin
  insert into public.user_stats (id, scan_count)
  values (row_id, 1)
  on conflict (id)
  do update set scan_count = user_stats.scan_count + 1;
end;
$$ language plpgsql security definer;