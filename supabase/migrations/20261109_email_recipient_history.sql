-- Gmail-style recent recipient cache
create table if not exists public.email_recipient_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  name text,
  roles text[] not null default '{}'::text[],
  use_count integer not null default 1,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists email_recipient_history_user_email_unique
  on public.email_recipient_history (user_id, lower(email));

create index if not exists email_recipient_history_user_last_used_idx
  on public.email_recipient_history (user_id, last_used_at desc);

alter table public.email_recipient_history enable row level security;

-- 서버에서는 service role을 사용하므로 일반 클라이언트 정책은 없어도 됩니다.

-- 기존 campaign_email_sends의 To 발송 이력을 새 캐시에 백필합니다.
insert into public.email_recipient_history (
  user_id,
  email,
  name,
  roles,
  use_count,
  last_used_at,
  created_at,
  updated_at
)
select
  ces.sender_user_id,
  ces.recipient_email,
  max(i.name) as name,
  array['to']::text[],
  count(*)::integer as use_count,
  max(coalesce(ces.sent_at, ces.created_at)) as last_used_at,
  min(ces.created_at) as created_at,
  now() as updated_at
from public.campaign_email_sends ces
left join public.influencers i
  on i.id = ces.influencer_id
where
  ces.recipient_email is not null
  and trim(ces.recipient_email) <> ''
group by
  ces.sender_user_id,
  lower(ces.recipient_email),
  ces.recipient_email
on conflict (user_id, lower(email))
do update set
  name = coalesce(excluded.name, public.email_recipient_history.name),
  roles = (
    select array(
      select distinct x
      from unnest(
        public.email_recipient_history.roles || excluded.roles
      ) as x
    )
  ),
  use_count = greatest(
    public.email_recipient_history.use_count,
    excluded.use_count
  ),
  last_used_at = greatest(
    public.email_recipient_history.last_used_at,
    excluded.last_used_at
  ),
  updated_at = now();
