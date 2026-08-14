-- =====================================================================
-- 0016 — الدعم الفني: قناة بين الشركة ومالك المنصة
--
-- بلا هذه القناة يصل عطل العميل عبر واتساب أو مكالمة، فيضيع بلا أثر:
-- لا يُعرف كم بلاغًا ورد، ولا كم بقي مفتوحًا، ولا أي شركة تعاني أكثر.
-- ومؤشر «كم شكوى في هذه الشركة» هو أبكر إنذار بمغادرة عميل.
--
-- ملاحظة عزل: التذكرة تحمل company_id، فيراها موظفو شركتها ومالك
-- المنصة وحدهم. ولا يرى مالك المنصة **محتوى مستندات** أي شركة — ما
-- يراه هو ما كتبه العميل في التذكرة عمدًا.
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ticket_status') then
    create type public.ticket_status as enum ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
  end if;
  if not exists (select 1 from pg_type where typname = 'ticket_priority') then
    create type public.ticket_priority as enum ('LOW', 'NORMAL', 'HIGH', 'URGENT');
  end if;
end
$$;

create table if not exists public.support_tickets (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  created_by  uuid references public.profiles(id) on delete set null,
  subject     text not null,
  category    text,
  status      public.ticket_status not null default 'OPEN',
  priority    public.ticket_priority not null default 'NORMAL',
  -- يُحدَّث مع كل رسالة، فيُرتَّب به دون مسح الرسائل
  last_reply_at timestamptz not null default now(),
  -- هل آخر ردّ من المنصة؟ يميّز ما ينتظر ردّي عمّا ينتظر العميل
  awaiting_platform boolean not null default true,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint support_tickets_subject_not_blank check (length(btrim(subject)) > 0)
);

create index if not exists support_tickets_company_idx
  on public.support_tickets (company_id, created_at desc);
create index if not exists support_tickets_open_idx
  on public.support_tickets (status, last_reply_at desc)
  where status in ('OPEN', 'IN_PROGRESS');

create table if not exists public.support_messages (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.support_tickets(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete set null,
  -- true إذا كان الكاتب مالك المنصة — يحدّد جهة الرسالة في العرض
  from_platform boolean not null default false,
  body       text not null,
  created_at timestamptz not null default now(),
  constraint support_messages_body_not_blank check (length(btrim(body)) > 0)
);

create index if not exists support_messages_ticket_idx
  on public.support_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

-- ---------- سياسات التذاكر ----------

drop policy if exists support_tickets_select on public.support_tickets;
create policy support_tickets_select on public.support_tickets
  for select to authenticated
  using (public.is_super_admin() or company_id = public.current_company_id());

-- ينشئ التذكرة أي مستخدم نشط في شركته — العطل قد يصيب موظفًا لا مديرًا
drop policy if exists support_tickets_insert on public.support_tickets;
create policy support_tickets_insert on public.support_tickets
  for insert to authenticated
  with check (company_id = public.current_company_id() and created_by = auth.uid());

-- التحديث (الحالة والأولوية) لمالك المنصة وحده: لو ملك العميل إغلاق
-- تذكرته وفتحها لصار مؤشر «كم بقي مفتوحًا» بلا معنى.
drop policy if exists support_tickets_update on public.support_tickets;
create policy support_tickets_update on public.support_tickets
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---------- سياسات الرسائل ----------

drop policy if exists support_messages_select on public.support_messages;
create policy support_messages_select on public.support_messages
  for select to authenticated
  using (public.is_super_admin() or company_id = public.current_company_id());

-- يكتب العميل رسائل شركته بلا وسم «من المنصة»، ويكتب مالك المنصة بوسمه.
-- الشرط يمنع انتحال جهة الرسالة: عميل يضع from_platform = true يجعل
-- ردّه يبدو ردًّا رسميًا من المنصة أمام زملائه.
drop policy if exists support_messages_insert on public.support_messages;
create policy support_messages_insert on public.support_messages
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      (public.is_super_admin() and from_platform = true)
      or (company_id = public.current_company_id() and from_platform = false)
    )
  );

grant select, insert on public.support_tickets to authenticated;
grant update on public.support_tickets to authenticated;
grant select, insert on public.support_messages to authenticated;

-- ---------- تحديث التذكرة عند كل رسالة ----------

create or replace function public.bump_ticket_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_tickets
     set last_reply_at = new.created_at,
         -- ردّ المنصة يُخرج التذكرة من طابور انتظاري، ورسالة العميل تُعيدها
         awaiting_platform = not new.from_platform,
         status = case
                    when new.from_platform then status
                    when status in ('RESOLVED', 'CLOSED') then 'OPEN'
                    else status
                  end
   where id = new.ticket_id;
  return new;
end;
$$;

drop trigger if exists support_messages_bump on public.support_messages;
create trigger support_messages_bump
  after insert on public.support_messages
  for each row execute function public.bump_ticket_on_message();

-- =====================================================================
-- ملخّص الشركات لمالك المنصة — مصدر التصدير إلى Excel
--
-- يُجمَّع في دالة واحدة بدل استعلامات متفرقة في الواجهة: التصدير
-- والعرض يقرآن الأرقام نفسها، فلا يختلف ما تراه عمّا تُرسله للعميل.
-- =====================================================================

create or replace function public.platform_companies_report()
returns table (
  company_id      uuid,
  company_name    text,
  status          public.company_status,
  is_demo         boolean,
  plan_name       text,
  subscription_status public.subscription_status,
  users_count     bigint,
  documents_count bigint,
  questions_count bigint,
  unanswered_count bigint,
  open_tickets    bigint,
  last_activity_at timestamptz,
  created_at      timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.name,
    c.status,
    c.is_demo,
    p.name,
    s.status,
    (select count(*) from public.profiles pr
      where pr.company_id = c.id and pr.status <> 'DISABLED'),
    (select count(*) from public.documents d
      where d.company_id = c.id and d.status <> 'ARCHIVED'),
    (select count(*) from public.messages m
      where m.company_id = c.id and m.role = 'USER'),
    (select count(*) from public.messages m
      where m.company_id = c.id and m.answer_status = 'UNANSWERED'),
    (select count(*) from public.support_tickets t
      where t.company_id = c.id and t.status in ('OPEN', 'IN_PROGRESS')),
    (select max(m.created_at) from public.messages m where m.company_id = c.id),
    c.created_at
  from public.companies c
  left join public.subscriptions s on s.company_id = c.id
  left join public.plans p on p.id = s.plan_id
  order by c.created_at desc;
end;
$$;

revoke all on function public.platform_companies_report() from public, anon;
grant execute on function public.platform_companies_report() to authenticated;
