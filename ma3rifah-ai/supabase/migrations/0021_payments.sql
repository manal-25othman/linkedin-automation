-- =====================================================================
-- 0021 — سجلّ المدفوعات وتفعيل الاشتراك
--
-- المبدأ الحاكم: لا شيء في هذا النظام يصدّق العميل في أمر الدفع.
-- المتصفح يُعاد إليه من البوابة بعنوان يحمل «نجح»، وذلك العنوان يمكن
-- كتابته يدويًا. فالحقيقة الوحيدة هي ما تقوله واجهة Moyasar حين نسألها
-- نحن من الخادم بمفتاحنا السري.
--
-- ولذلك يُخزَّن كل دفع هنا بمعرّفه لدى البوابة، ويُقيَّد بالشركة والخطة
-- والمبلغ الذي طُلب فعلًا — كي يُقارَن بما دُفع. ودفعُ ٤٩٩ لخطة ثمنها
-- ٩٩٩ يجب أن يُرفض، وهو ما لا يُكتشف إلا بحفظ المطلوب وقت الطلب.
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum ('INITIATED', 'PAID', 'FAILED', 'REFUNDED');
  end if;
end
$$;

create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  plan_id      uuid not null references public.plans(id) on delete restrict,
  initiated_by uuid references public.profiles(id) on delete set null,

  -- معرّف الدفع لدى البوابة. فريد كي لا يُحتسب النداء المكرر مرتين:
  -- البوابات تعيد إرسال الـwebhook عند أي شك في الوصول، وهذا متوقّع
  -- لا استثنائي.
  provider          text not null default 'moyasar',
  provider_payment_id text unique,

  -- المبلغ بالهللة كما تتعامل به Moyasar. عدد صحيح لا عشري: الحساب
  -- بالعشري يُدخل خطأ التقريب في المال، وهو آخر موضع يُحتمل فيه.
  amount_halalas int not null check (amount_halalas > 0),
  currency       text not null default 'SAR',

  status       public.payment_status not null default 'INITIATED',
  failure_reason text,

  -- نسخة كاملة من ردّ البوابة وقت التحقق — مرجع عند أي نزاع
  provider_payload jsonb,

  paid_at    timestamptz,
  -- لحظة تحويل هذه الدفعة إلى اشتراك. وجودها يمنع تطبيقها مرتين، وهو
  -- ما لا يكفي فيه فحصُ الحالة وحده: الحالة تبقى PAID بعد التطبيق.
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_company_idx
  on public.payments (company_id, created_at desc);
create index if not exists payments_status_idx
  on public.payments (status);

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.payments enable row level security;

-- يراها مدير الشركة وحده: الفاتورة شأن مالي لا يخصّ الموظفين.
-- ولا سياسة كتابة إطلاقًا — الإنشاء والتحديث بمفتاح الخدمة فقط، لأن
-- من يستطيع كتابة صفّ دفع يستطيع منح نفسه اشتراكًا.
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and (public.is_company_admin() or public.is_super_admin())
  );

grant select on public.payments to authenticated;

-- =====================================================================
-- تفعيل الاشتراك بعد دفعة مؤكَّدة
--
-- تُستدعى بمفتاح الخدمة بعد أن يكون الخادم قد سأل البوابة وتأكّد.
-- ولا تُمنح لأي دور آخر: هي الباب الذي يحوّل «دفع» إلى «اشتراك».
--
-- والدالة idempotent بحارس صريح لا بحسن النية: تُقفل صفّ الدفعة، وترفض
-- المضي إن كان applied_at مضبوطًا. فحصُ الحالة وحده لا يكفي — الحالة
-- تبقى PAID بعد التطبيق، فيمدّد النداء الثاني شهرًا بلا مقابل.
--
-- والنداء المكرر ليس احتمالًا نظريًا: الـwebhook يصل مرتين بحكم تصميم
-- البوابات، وقد يتزامن مع عودة المتصفح من صفحة الدفع. و FOR UPDATE
-- يحسم السباق بينهما بدل أن يمرّا معًا.
-- =====================================================================

create or replace function public.activate_subscription_for_payment(p_payment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_interval interval;
  v_base timestamptz;
begin
  -- القفل قبل القراءة: نداءان متزامنان يصطفّان بدل أن يقرآ الحالة نفسها
  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found or v_payment.status <> 'PAID' then
    return false;
  end if;

  -- طُبِّقت من قبل ⇒ لا شيء يُفعل، والإرجاع false كي لا يُفهَم تفعيلًا جديدًا
  if v_payment.applied_at is not null then
    return false;
  end if;

  select case when p.billing_interval = 'YEARLY' then interval '1 year'
              else interval '1 month' end
    into v_interval
  from public.plans p where p.id = v_payment.plan_id;

  -- التمديد من نهاية الفترة الحالية إن كانت قائمة، ومن الآن إن انقضت.
  -- الاحتساب من الآن دائمًا يبتلع ما تبقّى للعميل من أيام دفع ثمنها.
  select greatest(coalesce(s.current_period_end, now()), now())
    into v_base
  from public.subscriptions s
  where s.company_id = v_payment.company_id;

  v_base := coalesce(v_base, now());

  insert into public.subscriptions
    (company_id, plan_id, status, current_period_start, current_period_end)
  values
    (v_payment.company_id, v_payment.plan_id, 'ACTIVE', now(), v_base + v_interval)
  on conflict (company_id) do update
    set plan_id              = excluded.plan_id,
        status               = 'ACTIVE',
        current_period_start = now(),
        current_period_end   = excluded.current_period_end,
        canceled_at          = null;

  update public.payments set applied_at = now() where id = p_payment_id;

  return true;
end;
$$;

revoke all on function public.activate_subscription_for_payment(uuid) from public, anon, authenticated;
grant execute on function public.activate_subscription_for_payment(uuid) to service_role;
