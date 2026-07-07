create table if not exists public.xp_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  points integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, source)
);

grant select on public.xp_ledger to authenticated;
grant all on public.xp_ledger to service_role;

alter table public.xp_ledger enable row level security;

drop policy if exists "own xp select" on public.xp_ledger;
create policy "own xp select"
  on public.xp_ledger for select
  to authenticated
  using (user_id = auth.uid());

create index if not exists xp_ledger_user_idx on public.xp_ledger(user_id);

create or replace function public.award_xp(_user_id uuid, _source text, _points integer)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.xp_ledger (user_id, source, points)
  values (_user_id, _source, _points)
  on conflict (user_id, source) do nothing;
$$;

create or replace function public.on_lesson_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.completed = true and (tg_op = 'INSERT' or coalesce(old.completed, false) = false) then
    perform public.award_xp(new.user_id, 'lesson:' || new.lesson_id::text, 10);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lesson_completed on public.lesson_progress;
create trigger trg_lesson_completed
  after insert or update on public.lesson_progress
  for each row execute function public.on_lesson_completed();

create or replace function public.on_enrolled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' then
    perform public.award_xp(new.user_id, 'enroll:' || new.course_id::text, 25);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enrolled on public.enrollments;
create trigger trg_enrolled
  after insert or update on public.enrollments
  for each row execute function public.on_enrolled();

insert into public.xp_ledger (user_id, source, points)
select user_id, 'lesson:' || lesson_id::text, 10
from public.lesson_progress where completed = true
on conflict (user_id, source) do nothing;

insert into public.xp_ledger (user_id, source, points)
select user_id, 'enroll:' || course_id::text, 25
from public.enrollments where status = 'active'
on conflict (user_id, source) do nothing;

create or replace function public.my_xp()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(points), 0)::integer
  from public.xp_ledger
  where user_id = auth.uid();
$$;

grant execute on function public.my_xp() to authenticated;

create or replace function public.leaderboard(_limit integer default 20)
returns table (rank bigint, user_id uuid, name text, xp integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    row_number() over (order by sum(x.points) desc) as rank,
    x.user_id,
    coalesce(nullif(trim(p.full_name), ''), 'طالب') as name,
    sum(x.points)::integer as xp
  from public.xp_ledger x
  left join public.profiles p on p.id = x.user_id
  group by x.user_id, p.full_name
  order by xp desc
  limit greatest(1, least(coalesce(_limit, 20), 100));
$$;

grant execute on function public.leaderboard(integer) to authenticated;