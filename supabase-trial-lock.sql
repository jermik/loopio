create table if not exists public.trial_locks (
  device_id text primary key,
  used_seconds integer not null default 0,
  limit_seconds integer not null default 3600,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  machine_name text,
  app_version text,
  updated_at timestamptz not null default now()
);

alter table public.trial_locks enable row level security;

revoke all on public.trial_locks from anon, authenticated;

drop function if exists public.ensure_trial_lock(text, text, text, integer);
create or replace function public.ensure_trial_lock(
  p_device_id text,
  p_machine_name text default null,
  p_app_version text default null,
  p_limit_seconds integer default 3600
)
returns table (
  used_seconds integer,
  limit_seconds integer,
  remaining_seconds integer,
  is_expired boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.trial_locks as t (
    device_id, used_seconds, limit_seconds, machine_name, app_version, first_seen_at, last_seen_at, updated_at
  ) values (
    p_device_id, 0, greatest(1, p_limit_seconds), p_machine_name, p_app_version, now(), now(), now()
  )
  on conflict (device_id) do update
  set machine_name = coalesce(excluded.machine_name, t.machine_name),
      app_version = coalesce(excluded.app_version, t.app_version),
      last_seen_at = now(),
      updated_at = now();

  return query
  select
    t.used_seconds,
    t.limit_seconds,
    greatest(0, t.limit_seconds - t.used_seconds) as remaining_seconds,
    t.used_seconds >= t.limit_seconds as is_expired
  from public.trial_locks t
  where t.device_id = p_device_id;
end;
$$;

drop function if exists public.consume_trial_seconds(text, integer, text, text, integer);
create or replace function public.consume_trial_seconds(
  p_device_id text,
  p_increment integer,
  p_machine_name text default null,
  p_app_version text default null,
  p_limit_seconds integer default 3600
)
returns table (
  used_seconds integer,
  limit_seconds integer,
  remaining_seconds integer,
  is_expired boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_increment integer := greatest(0, coalesce(p_increment, 0));
begin
  perform public.ensure_trial_lock(p_device_id, p_machine_name, p_app_version, p_limit_seconds);

  update public.trial_locks t
  set used_seconds = least(t.limit_seconds, t.used_seconds + v_increment),
      machine_name = coalesce(p_machine_name, t.machine_name),
      app_version = coalesce(p_app_version, t.app_version),
      last_seen_at = now(),
      updated_at = now()
  where t.device_id = p_device_id;

  return query
  select
    t.used_seconds,
    t.limit_seconds,
    greatest(0, t.limit_seconds - t.used_seconds) as remaining_seconds,
    t.used_seconds >= t.limit_seconds as is_expired
  from public.trial_locks t
  where t.device_id = p_device_id;
end;
$$;

grant execute on function public.ensure_trial_lock(text, text, text, integer) to anon, authenticated;
grant execute on function public.consume_trial_seconds(text, integer, text, text, integer) to anon, authenticated;
