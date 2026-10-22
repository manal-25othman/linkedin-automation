-- =====================================================================
-- 0047 — الإجابة متعددة الوثائق: ما تقوله، ومن أين، وأين تتعارض
--
-- الموجّه يأمر النموذج أن يختم كل جملة بعلامة مصدرها، وأن يُعلن
-- التعارض بدل أن يحسمه ضمنًا. وهو يفعل. ثم **يُرمى كل ذلك**:
--
--   • علامات `[مصدر ن]` تُستخرج لتُعرف المصادر المستعملة، ثم تُحذف من
--     النصّ — فيبقى «ما المصادر» ويضيع «أيّ جملة من أيّ مصدر».
--   • التعارض يُكتب في نصّ الإجابة نثرًا، ولا يُسجَّل في أي حقل، فلا
--     يُعدّ ولا يُراجع ولا يصل إلى مدير يملك حسمه.
--   • الاستشهاد يشير إلى `documents.id`، وهو إصدارٌ بعينه — لكن اسم
--     الإصدار لا يُحفظ. فإن أُرشف الإصدار لاحقًا صار الاستشهاد يشير
--     إلى صفٍّ بلا وصف، ولا يعرف القارئ أنّ جوابه كان من النسخة
--     السابقة.
--
-- والثالث أخطرها على منتجٍ كلّ دعواه أنّ الجواب مُسنَد: استشهادٌ لا
-- يُعرف إصداره استشهادٌ ناقص.
-- =====================================================================

-- ---------- أثر الإصدار على الاستشهاد ----------
--
-- يُنسخ وقت الحفظ لا يُقرأ وقت العرض: الغرض أن تبقى الإجابة قابلة
-- للقراءة كما كانت يوم صدرت، حتى لو تغيّرت العائلة بعدها. والقراءة
-- وقت العرض تُظهر الإصدار **الحالي** مكان الذي أجاب فعلًا — وهو كذبٌ
-- صامت على القارئ.

alter table public.message_sources
  add column if not exists family_id     uuid references public.document_families(id) on delete set null,
  add column if not exists version_label text;

comment on column public.message_sources.version_label is
  'اسم الإصدار كما كان يوم صدرت الإجابة. منسوخ لا مقروء: العائلة '
  'تتغيّر، والاستشهاد يجب أن يبقى صادقًا عن لحظته.';

create index if not exists message_sources_family_idx
  on public.message_sources (family_id)
  where family_id is not null;

-- ---------- التغطية والتعارض على مستوى الرسالة ----------

alter table public.messages
  -- ما لم تغطّه الوثائق، بنصّ النموذج. غير فارغ ⇒ الحالة `PARTIAL`.
  add column if not exists coverage_note text,
  -- وصفٌ محسوب لتعارضٍ مشتبَه به بين وثيقتين. غير فارغ ⇒ يُعرض تنبيه.
  add column if not exists conflict_note text;

comment on column public.messages.conflict_note is
  'تعارض مشتبَه به بين مصدرين، محسوب حسابيًا لا بحكم النموذج: '
  'مقطعان من عائلتين مختلفتين، موضوعهما واحد لفظيًا وأرقامهما تختلف. '
  'إشارةٌ إلى موضع يستحقّ النظر، لا حكمٌ بوقوع التعارض.';

-- ---------- الجمل ومصادرها ----------
--
-- صفٌّ لكل جملة تحمل معلومة عن الشركة، ومعه الوثائق التي استُمدّت
-- منها. وبه تصير الإجابة قابلة للمراجعة جملةً جملة بدل أن تُراجع
-- كتلةً واحدة أمام قائمة مصادر.
--
-- والربط بالوثيقة لا بموضع المصدر في القائمة: المواضع تُدمج قبل
-- الحفظ (مقطعان من صفحة واحدة يصيران صفًّا واحدًا)، فموضعٌ محفوظ قد
-- لا يجد صفَّه. والوثيقة لا تضيع.

create table if not exists public.message_claims (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  message_id   uuid not null references public.messages(id) on delete cascade,
  -- ترتيب الجملة في الإجابة، بادئًا من صفر
  position     int  not null,
  text         text not null,
  -- الوثائق (إصداراتٍ بعينها) التي استُشهد بها لهذه الجملة
  document_ids uuid[] not null default '{}',
  created_at   timestamptz not null default now(),
  unique (message_id, position)
);

create index if not exists message_claims_message_idx
  on public.message_claims (message_id);

alter table public.message_claims enable row level security;
alter table public.message_claims force row level security;

/*
 * السياسة نسخةٌ من سياسة `message_sources` عمدًا، لا اجتهادًا جديدًا.
 *
 * الجمل أجزاء من الإجابة نفسها، فمن يقرأ الإجابة يقرأ جملها ولا أحد
 * غيره. وأيّ توسيعٍ هنا — «والمديرون أيضًا» — يفتح محادثات الموظفين
 * الخاصة من باب جانبي، بينما `messages` نفسها مغلقة عليهم.
 */

drop policy if exists message_claims_select on public.message_claims;
create policy message_claims_select on public.message_claims
  for select to authenticated
  using (
    exists (
      select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_claims.message_id
        and c.user_id = auth.uid()
        and public.belongs_to_current_company(c.company_id)
    )
  );

drop policy if exists message_claims_insert on public.message_claims;
create policy message_claims_insert on public.message_claims
  for insert to authenticated
  with check (company_id = public.current_company_id());

-- لا سياسة تحديث ولا حذف: الجملة سجلٌّ لما قيل، وتعديلُها يفسد
-- المراجعة التي وُجدت لها.

-- =====================================================================
-- وصف الإصدار لوثيقةٍ بعينها — لتُملأ به الاستشهادات
--
-- تُنادى بجلسة المستخدم: تقرأ `can_read_document` فتردّ خاويةً عن
-- وثيقةٍ لا يحقّ للسائل رؤيتها. وبمفتاح الخدمة تردّ خاويةً دائمًا بلا
-- خطأ — فتُحفظ الاستشهادات بلا أسماء إصدارات، صامتةً.
-- =====================================================================

create or replace function public.describe_document_versions(
  p_document_ids uuid[]
)
returns table (
  document_id   uuid,
  family_id     uuid,
  version_label text
)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.family_id, d.version_label
    from public.documents d
   where d.id = any(p_document_ids)
     and public.can_read_document(
           d.company_id, d.visibility, d.allowed_department_ids, d.allowed_roles);
$$;

revoke all on function public.describe_document_versions(uuid[]) from public, anon;
grant execute on function public.describe_document_versions(uuid[]) to authenticated;
