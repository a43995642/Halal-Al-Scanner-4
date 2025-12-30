-- 1. إنشاء جدول إحصائيات المستخدمين (عدد الفحوصات والاشتراك)
create table if not exists public.user_stats (
  id uuid references auth.users on delete cascade not null primary key,
  scan_count int default 0,
  is_premium boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. إنشاء جدول التقارير (للإبلاغ عن الأخطاء)
create table if not exists public.reports (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete set null,
  original_text text,
  ai_result jsonb,
  user_correction text,
  user_notes text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. تفعيل الحماية (RLS)
alter table public.user_stats enable row level security;
alter table public.reports enable row level security;

-- 4. سياسات الأمان (Policies)

-- السماح للمستخدم بقراءة إحصائياته فقط
create policy "Users can view their own stats"
  on public.user_stats for select
  using ( auth.uid() = id );

-- السماح للمستخدم (أو المجهول) بإضافة تقرير
create policy "Anyone can insert reports"
  on public.reports for insert
  with check ( true );

-- 5. دالة لزيادة عدد الفحوصات (RPC Function)
-- يتم استدعاؤها من الباك-إند لزيادة العداد بشكل آمن
create or replace function increment_scan_count(row_id uuid)
returns void as $$
begin
  insert into public.user_stats (id, scan_count)
  values (row_id, 1)
  on conflict (id)
  do update set scan_count = user_stats.scan_count + 1;
end;
$$ language plpgsql security definer;