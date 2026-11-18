-- ConWork: Web Push (notifications reach phones and computers even when ConWork is closed)
-- Run on the Neon database (where the notifications table lives). Safe to run again.
-- What it adds:
--   push_subscriptions      one row per device/browser that allowed notifications
--   notifications.pushed_at when the push for that notification was sent (null = not yet)
--   save_push_subscription / delete_push_subscription  called by js/pwa.js

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_sub_read_own on public.push_subscriptions;
create policy push_sub_read_own on public.push_subscriptions for select using (user_id = auth.uid());
drop policy if exists push_sub_delete_own on public.push_subscriptions;
create policy push_sub_delete_own on public.push_subscriptions for delete using (user_id = auth.uid());
grant select, delete on public.push_subscriptions to authenticated;

-- notifications made before this script are not pushed
alter table public.notifications add column if not exists pushed_at timestamptz;
update public.notifications set pushed_at = coalesce(created_at, now()) where pushed_at is null;
create index if not exists notifications_push_pending on public.notifications (created_at) where pushed_at is null;

-- this browser allowed notifications: keep its address for the signed-in person
-- (the same browser signing in as someone else moves the address to that person)
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if coalesce(p_endpoint, '') !~ '^https://' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then raise exception 'bad subscription'; end if;
  insert into push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
    user_agent = excluded.user_agent, created_at = now();
end $$;

-- sign out / notifications switched off on this browser
create or replace function public.delete_push_subscription(p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
end $$;

revoke all on function public.save_push_subscription(text, text, text, text) from public;
revoke all on function public.delete_push_subscription(text) from public;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.delete_push_subscription(text) to authenticated;
