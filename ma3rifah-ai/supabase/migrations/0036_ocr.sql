-- =====================================================================
-- 0036 — القراءة الضوئية (OCR) للمستندات الممسوحة والصور
--
-- كان الملف الممسوح ضوئيًا يُرفض برسالة «يحتاج OCR أولًا». وأكثر ما في
-- أدراج الشركات السعودية تعاميم مصوَّرة، فالرفض يُخرج نصف الأرشيف.
--
-- الآن تُقرأ صفحاته بنموذج الرؤية وتُخزَّن نصًّا صفحةً صفحة، ثم تدخل
-- خطّ الفهرسة كأي مستند. وللقراءة تكلفة بالصفحة، فلها حدٌّ شهري في
-- الخطة كحدّ الأسئلة.
-- =====================================================================

-- ---------- حدّ الخطة ----------

alter table public.plans
  add column if not exists max_ocr_pages_monthly int;

-- القيم الابتدائية للخطط القائمة. null = بلا حد (كبقية حدود Enterprise).
update public.plans
   set max_ocr_pages_monthly = case code
     when 'TRIAL'    then 20
     when 'STARTER'  then 150
     when 'GROWTH'   then 600
     when 'BUSINESS' then 2000
     else max_ocr_pages_monthly
   end
 where max_ocr_pages_monthly is null;

-- ---------- العدّاد الشهري ----------

alter table public.usage_records
  add column if not exists ocr_pages int not null default 0;

-- ---------- المستند ----------
-- عدد الصفحات التي قُرئت ضوئيًا. صفر = مستند نصّي عادي.
alter table public.documents
  add column if not exists ocr_pages int not null default 0;

-- ---------- نصوص الصفحات المقروءة ----------
-- تُخزَّن صفحةً صفحة كي تُستأنف القراءة من حيث توقفت: المعالجة تجري
-- داخل عمر طلب واحد محدود، والمستند الطويل لا يكتمل في نداء واحد.
create table if not exists public.document_ocr_pages (
  document_id uuid not null references public.documents(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  page_number int  not null check (page_number >= 1),
  text        text not null,
  created_at  timestamptz not null default now(),
  primary key (document_id, page_number)
);

-- الجدول لخطّ المعالجة وحده (مفتاح الخدمة). لا سياسة لأي دور مصادَق:
-- تفعيل RLS بلا سياسات يعني رفض كل قراءة وكتابة من المستخدمين.
alter table public.document_ocr_pages enable row level security;
revoke all on public.document_ocr_pages from public, anon, authenticated;

-- ---------- مفتاح الحدّ الجديد في محلّل الحدود ----------

create or replace function public.effective_plan_limit(
  p_company uuid,
  p_key text
)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limit int;
  v_override int;
begin
  if p_key not in (
    'max_users', 'max_documents', 'max_storage_mb', 'max_questions_monthly',
    'max_ocr_pages_monthly'
  ) then
    raise exception 'unknown plan limit key: %', p_key using errcode = '22023';
  end if;

  execute format(
    'select p.%I from public.subscriptions s
       join public.plans p on p.id = s.plan_id
      where s.company_id = $1',
    p_key
  )
  into v_limit
  using p_company;

  select nullif(s.limit_overrides ->> p_key, '')::int
    into v_override
  from public.subscriptions s
  where s.company_id = p_company;

  return coalesce(v_override, v_limit);
end;
$$;

-- ---------- تسجيل الاستهلاك مع صفحات القراءة ----------

drop function if exists public.record_usage(uuid, int, bigint, bigint, numeric);

create or replace function public.record_usage(
  p_company_id uuid,
  p_questions int default 0,
  p_input_tokens bigint default 0,
  p_output_tokens bigint default 0,
  p_cost_usd numeric default 0,
  p_ocr_pages int default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usage_records
    (company_id, period_month, questions_count, input_tokens, output_tokens,
     estimated_cost_usd, ocr_pages)
  values
    (p_company_id, date_trunc('month', now())::date,
     p_questions, p_input_tokens, p_output_tokens, p_cost_usd, p_ocr_pages)
  on conflict (company_id, period_month) do update
    set questions_count    = public.usage_records.questions_count + excluded.questions_count,
        input_tokens       = public.usage_records.input_tokens + excluded.input_tokens,
        output_tokens      = public.usage_records.output_tokens + excluded.output_tokens,
        estimated_cost_usd = public.usage_records.estimated_cost_usd + excluded.estimated_cost_usd,
        ocr_pages          = public.usage_records.ocr_pages + excluded.ocr_pages,
        updated_at         = now();
end;
$$;

revoke all on function public.record_usage(uuid, int, bigint, bigint, numeric, int) from public, anon, authenticated;
grant execute on function public.record_usage(uuid, int, bigint, bigint, numeric, int) to service_role;

-- ---------- فحص حصة القراءة الضوئية ----------
-- تأخذ معرّف الشركة صراحةً لأنها تُستدعى من خطّ المعالجة بمفتاح الخدمة
-- لا من جلسة مستخدم. ولذلك لا يُمنح تنفيذها لأي دور مصادَق: مستخدمٌ
-- يستطيع استدعاءها بمعرّف شركة أخرى يعرف استهلاكها، وهذا تسريب.

create or replace function public.check_ocr_quota(p_company uuid, p_pages int)
returns table (allowed boolean, used int, quota int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_quota int;
  v_used int;
begin
  v_quota := public.effective_plan_limit(p_company, 'max_ocr_pages_monthly');

  select coalesce(u.ocr_pages, 0) into v_used
  from public.usage_records u
  where u.company_id = p_company
    and u.period_month = date_trunc('month', now())::date;

  v_used := coalesce(v_used, 0);

  if v_quota is null then
    return query select true, v_used, -1;
  else
    return query select (v_used + greatest(p_pages, 0) <= v_quota), v_used, v_quota;
  end if;
end;
$$;

revoke all on function public.check_ocr_quota(uuid, int) from public, anon, authenticated;
grant execute on function public.check_ocr_quota(uuid, int) to service_role;

-- ---------- الصور صيغةً مقبولة في التخزين ----------

update storage.buckets
   set allowed_mime_types = (
     select array_agg(distinct m)
     from unnest(
       allowed_mime_types || array['image/png', 'image/jpeg', 'image/webp']
     ) as m
   )
 where id = 'documents';
