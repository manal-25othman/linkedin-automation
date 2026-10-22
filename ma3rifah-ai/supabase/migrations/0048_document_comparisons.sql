-- =====================================================================
-- 0048 — مقارنة إصدارين من وثيقة
--
-- العائلة تحفظ الإصدارات، ولا شيء يقول **ما الذي تغيّر**. والمدير
-- الذي يعتمد إصدارًا جديدًا من لائحةٍ من أربعين صفحة يُسأل عمليًا أن
-- يقرأها كاملةً ليعرف أنّ مهلة الإشعار صارت ستين يومًا بدل ثلاثين.
-- فلا يقرأ، ويعتمد.
--
-- وموضع الحساب هو القرار كلّه هنا:
--
--   **الفرق يُحسب حسابيًا، والنموذج يصوغه نثرًا — ولا يحسبه.**
--
-- لأنّ نموذجًا يُسأل «ما الفرق بين النصّين» يُنتج فرقًا معقولًا
-- المظهر، ويُسقط بندًا، ويبدّل رقمًا. ومقارنةُ لوائح مبنيّةٌ على جواب
-- نموذج هي بالضبط ما يَعِد هذا المنتج بألّا يفعله.
--
-- فالجدول يحفظ شيئين منفصلين: `diff` المحسوب — وهو الحقيقة — و
-- `summary` المصوغ، وهو تسهيل قراءة يجوز أن يغيب. وإذا غاب تبقى
-- المقارنة صحيحة.
-- =====================================================================

create table if not exists public.document_comparisons (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  family_id         uuid not null references public.document_families(id) on delete cascade,
  -- الإصدار الأقدم ثم الأحدث. الترتيب جزء من المعنى: «ما الذي أضافه
  -- الأحدث» ليس «ما الذي حذفه»، فلا يُعكس الصفّ ولا يُعاد استعماله.
  from_document_id  uuid not null references public.documents(id) on delete cascade,
  to_document_id    uuid not null references public.documents(id) on delete cascade,

  -- الفرق المحسوب: الفقرات المضافة والمحذوفة، والأرقام المتبدّلة.
  diff              jsonb not null,

  -- الصياغة النثرية — تُولَّد من `diff` وحده، وقد تكون فارغة.
  summary           text,
  summary_model     text,
  summary_at        timestamptz,

  computed_at       timestamptz not null default now(),
  computed_by       uuid references public.profiles(id) on delete set null,

  constraint document_comparisons_distinct check (from_document_id <> to_document_id),
  unique (from_document_id, to_document_id)
);

create index if not exists document_comparisons_family_idx
  on public.document_comparisons (family_id, computed_at desc);

alter table public.document_comparisons enable row level security;
alter table public.document_comparisons force row level security;

/*
 * القراءة تتبع رؤية العائلة، والكتابة لا سياسة لها.
 *
 * أمّا القراءة فلأنّ المقارنة تكشف نصَّ الإصدارين معًا: من لا يرى
 * العائلة لا يرى الفرق بين نسختيها. وتُستعمل `can_read_document_family`
 * نفسها لا شرطٌ مكافئ لها بالعين — فالمكافئ يتباعد عن أصله.
 *
 * وأمّا الكتابة فلأنّ الصفّ نتيجةُ حساب لا مُدخَلُ مستخدم. يكتبه
 * `save_document_comparison` وحده بعد أن يتحقق من الرؤية والقرابة،
 * فلا يستطيع عميلٌ أن يدسّ فرقًا ملفَّقًا بين إصدارين عبر PostgREST.
 */

drop policy if exists document_comparisons_select on public.document_comparisons;
create policy document_comparisons_select on public.document_comparisons
  for select to authenticated
  using (
    public.belongs_to_current_company(company_id)
    and public.can_read_document_family(family_id)
  );

-- =====================================================================
-- حفظ مقارنة محسوبة
--
-- يتحقق من ثلاثة قبل الكتابة: أنّ الإصدارين يُقرآن، وأنهما من عائلة
-- واحدة، وأنّ المنادي من شركتهما. والثاني ليس تزيّدًا: مقارنةٌ بين
-- وثيقتين لا صلة بينهما ليست خطأ عرضيًا بل نتيجةٌ بلا معنى تُحفظ
-- وتُقرأ لاحقًا كأنها مقارنة إصدارين.
-- =====================================================================

create or replace function public.save_document_comparison(
  p_from_document_id uuid,
  p_to_document_id   uuid,
  p_diff             jsonb,
  p_summary          text default null,
  p_summary_model    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from    public.documents%rowtype;
  v_to      public.documents%rowtype;
  v_id      uuid;
begin
  if p_from_document_id = p_to_document_id then
    raise exception 'لا تُقارن الوثيقة بنفسها.';
  end if;

  select * into v_from from public.documents where id = p_from_document_id;
  select * into v_to   from public.documents where id = p_to_document_id;

  if v_from.id is null or v_to.id is null then
    raise exception 'أحد الإصدارين غير موجود.';
  end if;

  if v_from.family_id is null or v_from.family_id <> v_to.family_id then
    raise exception 'الإصداران ليسا من وثيقة واحدة.';
  end if;

  if not public.can_read_document(
       v_from.company_id, v_from.visibility, v_from.allowed_department_ids, v_from.allowed_roles)
     or not public.can_read_document(
       v_to.company_id, v_to.visibility, v_to.allowed_department_ids, v_to.allowed_roles)
  then
    raise exception 'لا تملك صلاحية قراءة أحد الإصدارين.';
  end if;

  insert into public.document_comparisons (
    company_id, family_id, from_document_id, to_document_id,
    diff, summary, summary_model,
    summary_at, computed_at, computed_by
  )
  values (
    v_from.company_id, v_from.family_id, p_from_document_id, p_to_document_id,
    p_diff, p_summary, p_summary_model,
    case when p_summary is null then null else now() end, now(), auth.uid()
  )
  on conflict (from_document_id, to_document_id) do update
    set diff          = excluded.diff,
        summary       = excluded.summary,
        summary_model = excluded.summary_model,
        summary_at    = excluded.summary_at,
        computed_at   = now(),
        computed_by   = auth.uid()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.save_document_comparison(uuid, uuid, jsonb, text, text)
  from public, anon;
grant execute on function public.save_document_comparison(uuid, uuid, jsonb, text, text)
  to authenticated;
