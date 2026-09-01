-- =====================================================================
-- عزل المالك: مالك المنصّة لا يقرأ وثائق العملاء
-- =====================================================================
-- كانت `can_read_document` تبدأ بـ«إن كان القارئ SUPER_ADMIN فاسمح
-- دائمًا» — فتعرض لوحةُ المالك مستنداتِ كل الشركات، ويستطيع فتحها.
--
-- اكتشفتها المالكة نفسها: ملفُ شركةٍ عميلة ظهر في قائمتها. والعزل
-- بين العملاء لم يُمسّ (موظف شركةٍ لا يرى غيرها، والاسترجاع مقيّد
-- بشركة السائل حتى للمالك) — لكن وثيقة المتطلبات تعِد حرفيًا:
-- «مالك المنصّة لا يقرأ محتوى وثائق العملاء»، والقاعدة كانت تسمح.
--
-- الإصلاح: يسقط التجاوز الشامل، ويُعامل المالك كمدير شركةٍ **داخل
-- شركته هو** — وشرط تطابق الشركة قبلها يسدّ كل ما عداها.
create or replace function public.can_read_document(
  p_company_id uuid,
  p_visibility public.document_visibility,
  p_allowed_department_ids uuid[],
  p_allowed_roles public.user_role[]
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_company uuid;
  v_department uuid;
begin
  select role, company_id, department_id
    into v_role, v_company, v_department
  from public.profiles
  where id = auth.uid() and status = 'ACTIVE';

  if v_role is null or v_company is null or v_company <> p_company_id then
    return false;
  end if;

  -- مدير الشركة — والمالك داخل شركته هو — يريان كل مستندات الشركة
  if v_role in ('COMPANY_ADMIN', 'SUPER_ADMIN') then
    return true;
  end if;

  return case p_visibility
    when 'COMPANY'    then true
    when 'DEPARTMENT' then v_department is not null
                           and v_department = any (p_allowed_department_ids)
    when 'ROLE'       then v_role = any (p_allowed_roles)
    else false
  end;
end;
$$;

-- والبوابة الثانية — الأوسع أثرًا: «الانتماء» كان يعدّ المالك منتميًا
-- إلى كل شركة، وعليه تُبنى سياساتُ جداول كثيرة (المستندات كتابةً،
-- المحادثات، الفجوات…). فيصير الانتماء انتماءً حقيقيًا: تطابُق شركة
-- لا امتياز دور. وعمليات لوحة المنصّة لا تتأثر — فهي تمرّ بمفتاح
-- الخدمة أو بدوالّ محروسة بـ is_super_admin() صراحةً، لا بهذه.
create or replace function public.belongs_to_current_company(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_company_id is not null
     and p_company_id = public.current_company_id()
$$;
