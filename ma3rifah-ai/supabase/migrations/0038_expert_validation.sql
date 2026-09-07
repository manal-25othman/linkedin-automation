-- =====================================================================
-- 0038 — مساحة الخبراء: توجيه الفجوة إلى من يعرف جوابها
-- =====================================================================
-- العطل الذي دعت إليه:
--
-- كل سؤال في الشركة لم تجد المنصة جوابه ينتهي إلى شخص واحد — مدير
-- الشركة — لأن سياسة الكتابة على `knowledge_gaps` محصورة في
-- `is_company_admin()`. وهو في الغالب لا يعرف الجواب: سؤالُ عهدة
-- السلامة عند مسؤول السلامة، وسؤالُ بدل السكن عند المالية.
--
-- فيخرج المدير من المنصة ليسأل، ثم يعود ليكتب، أو — والأرجح — ينشغل
-- فتبقى الفجوة مفتوحة أسابيع. والنتيجة أن المنتج يكشف النقص ولا يسدّه.
--
-- والحلّ توجيهٌ لا توسيعُ صلاحية: تُسنَد الفجوة إلى موظف بعينه، فيرى
-- **ما أُسند إليه وحده** ويكتب مسوّدة جواب. والمسوّدة لا تدخل قاعدة
-- المعرفة: يعتمدها المدير بالمسار القائم نفسه. خبيرٌ يكتب ومديرٌ
-- يوقّع — كما هو الحال مع وكيل المسوّدات سواءً بسواء.
--
-- ولذلك لم تُفتح سياسة الكتابة: الخبير لا يملك `update` على الجدول
-- إطلاقًا، وكتابته تمرّ في دالّة واحدة تتحقّق من الإسناد وتكتب
-- عمودين لا غير. توسيع السياسة كان سيمنحه تعديل الحالة والإجابة
-- المعتمدة وكل ما في الصفّ.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ١) نوعا تنبيه جديدان
-- ---------------------------------------------------------------------
-- تُضاف القيم هنا ولا تُستعمل في هذه الهجرة: التنبيهات تُنشأ من الخادم
-- عبر `notifyUsers`، وقيمةُ enum مضافة في معاملة لا تصلح للاستعمال
-- داخلها.

alter type public.notification_type add value if not exists 'GAP_ASSIGNED';
alter type public.notification_type add value if not exists 'GAP_EXPERT_ANSWERED';

-- ---------------------------------------------------------------------
-- ٢) أعمدة الإسناد وجواب الخبير
-- ---------------------------------------------------------------------

alter table public.knowledge_gaps
  add column if not exists assigned_to        uuid references public.profiles(id) on delete set null,
  add column if not exists assigned_by        uuid references public.profiles(id) on delete set null,
  add column if not exists assigned_at        timestamptz,
  -- مسوّدة الخبير — منفصلة عن `answer_text` عمدًا: تلك ما اعتمده
  -- المدير وما دخل قاعدة المعرفة، وهذه اقتراحٌ لم يُعتمد بعد. ودمجهما
  -- في عمود واحد يعني أن كتابة الخبير تظهر للموظفين قبل أن يراها أحد.
  add column if not exists expert_answer      text,
  add column if not exists expert_answered_at timestamptz;

-- فهرس صفحة الخبير: «ما أُسند إليّ ولم أُجب عنه بعد»
create index if not exists knowledge_gaps_assigned_idx
  on public.knowledge_gaps (assigned_to, expert_answered_at nulls first, last_asked_at desc)
  where assigned_to is not null;

-- ---------------------------------------------------------------------
-- ٣) القراءة: المديرون كما كانوا، ويُضاف إليهم المُسنَد إليه وحده
-- ---------------------------------------------------------------------
-- الشرط الأول (`belongs_to_current_company`) باقٍ في صدر السياسة، فلا
-- يفتح الإسناد بابًا بين شركتين مهما اختلّ ما بعده.

drop policy if exists knowledge_gaps_select on public.knowledge_gaps;
create policy knowledge_gaps_select on public.knowledge_gaps
  for select to authenticated
  using (
    public.belongs_to_current_company(company_id)
    and (public.is_manager_or_above() or assigned_to = auth.uid())
  );

-- سياسة الكتابة لم تُمسّ: `is_company_admin()` كما كانت.

-- ---------------------------------------------------------------------
-- ٤) كتابة الخبير — دالّة واحدة بعمودين
-- ---------------------------------------------------------------------
-- `security definer` لأن الخبير بلا سياسة كتابة. والدالّة هي الحارس:
-- تتحقّق أن الصفّ في شركة المنادي، وأنه هو المُسنَد إليه، ثم تكتب
-- `expert_answer` و`expert_answered_at` ولا شيء غيرهما — لا الحالة،
-- ولا الإجابة المعتمدة، ولا الإسناد نفسه.

create or replace function public.submit_expert_answer(
  p_gap_id uuid,
  p_answer text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_updated int;
begin
  if p_answer is null or length(btrim(p_answer)) < 20 then
    raise exception 'answer_too_short';
  end if;

  v_company := public.current_company_id();
  if v_company is null then
    return false;
  end if;

  update public.knowledge_gaps
  set expert_answer      = btrim(p_answer),
      expert_answered_at = now()
  where id = p_gap_id
    and company_id = v_company
    and assigned_to = auth.uid();

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.submit_expert_answer(uuid, text) from public;
grant execute on function public.submit_expert_answer(uuid, text) to authenticated;
