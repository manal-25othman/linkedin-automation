-- =====================================================================
-- 0020 — فرض حدود الخطة: المستخدمون والمستندات والتخزين
--
-- كانت هذه الحدود تُعرض على صفحة الأسعار وتُخزَّن في جدول `plans` ولا
-- تُفحص في أي مكان. فشركة على خطة Starter (٥٠ مستخدمًا، ١٠٠ مستند)
-- تستطيع إضافة ٥٠٠ مستخدم و١٠٬٠٠٠ مستند بلا مانع.
--
-- وهذا لا يُقاس بخسارة إيراد فحسب: خطة لا تُفرض حدودها تجعل الفرق بين
-- ٤٩٩ و٩٩٩ ريالًا وعدًا لا يقابله شيء، فلا يبقى سبب يدفع عميلًا
-- للترقية — وهو ما يُبطل التسعير كله قبل أن تُربط بوابة الدفع.
--
-- والحصة الشهرية للأسئلة كانت مفروضة وحدها (check_question_quota).
-- تتبع الدوالّ هنا نمطها عينه: نفس بنية الإرجاع، ونفس احترام
-- `limit_overrides` المتفاوَض عليها لكل عميل، ونفس معاملة NULL بوصفها
-- «بلا حد».
-- =====================================================================

-- ---------- حدّ الخطة النافذ ----------
--
-- تُقرأ القيمة من الخطة، ويعلوها تجاوزُ الاشتراك إن وُجد. دالة واحدة
-- كي لا تتكرر قاعدة الأولوية في كل موضع فتختلف بمرور الوقت.

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
  -- المفتاح يُقصر على المعروف: القيمة تدخل في تعبير ديناميكي أدناه،
  -- وقائمة بيضاء أوثق من أي تهريب.
  if p_key not in ('max_users', 'max_documents', 'max_storage_mb', 'max_questions_monthly') then
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

-- ---------- حدّ المستخدمين ----------
--
-- يُحتسب النشط والمدعو معًا: المدعو مقعد محجوز فعلًا، ولو لم يُحتسب
-- لأمكن تجاوز الحدّ بدعوات معلّقة ثم تفعيلها دفعةً واحدة.

create or replace function public.check_user_quota()
returns table (allowed boolean, used int, quota int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_quota int;
  v_used int;
begin
  select company_id into v_company
  from public.profiles where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    return query select false, 0, 0;
    return;
  end if;

  v_quota := public.effective_plan_limit(v_company, 'max_users');

  select count(*)::int into v_used
  from public.profiles
  where company_id = v_company and status in ('ACTIVE', 'INVITED');

  if v_quota is null then
    return query select true, v_used, -1;
  else
    return query select (v_used < v_quota), v_used, v_quota;
  end if;
end;
$$;

-- ---------- حدّ المستندات ----------
--
-- المؤرشف لا يُحتسب: هو خارج قاعدة المعرفة ولا يستهلك تضمينات، وعدّه
-- يعاقب الشركة على حسن التنظيم.

create or replace function public.check_document_quota()
returns table (allowed boolean, used int, quota int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_quota int;
  v_used int;
begin
  select company_id into v_company
  from public.profiles where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    return query select false, 0, 0;
    return;
  end if;

  v_quota := public.effective_plan_limit(v_company, 'max_documents');

  select count(*)::int into v_used
  from public.documents
  where company_id = v_company and status <> 'ARCHIVED';

  if v_quota is null then
    return query select true, v_used, -1;
  else
    return query select (v_used < v_quota), v_used, v_quota;
  end if;
end;
$$;

-- ---------- حدّ التخزين ----------
--
-- يُفحص قبل الرفع بحجم الملف القادم، لا بعده: الفحص البعدي يقبل ملفًا
-- يتجاوز الحدّ ثم يشكو، فيدفع العميل ثمن تخزين لم يشتره.
--
-- والوحدة ميغابايت لأن الخطة تُعرض بها، والتحويل هنا مرة واحدة بدل أن
-- يتكرر في كل موضع استدعاء.

create or replace function public.check_storage_quota(p_incoming_bytes bigint default 0)
returns table (allowed boolean, used_mb int, quota_mb int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_quota int;
  v_used_bytes bigint;
  v_used_mb int;
begin
  select company_id into v_company
  from public.profiles where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    return query select false, 0, 0;
    return;
  end if;

  v_quota := public.effective_plan_limit(v_company, 'max_storage_mb');

  select coalesce(sum(file_size_bytes), 0) into v_used_bytes
  from public.documents
  where company_id = v_company and status <> 'ARCHIVED';

  v_used_mb := ceil(v_used_bytes / 1048576.0)::int;

  if v_quota is null then
    return query select true, v_used_mb, -1;
  else
    return query select
      (ceil((v_used_bytes + greatest(coalesce(p_incoming_bytes, 0), 0)) / 1048576.0)::int <= v_quota),
      v_used_mb,
      v_quota;
  end if;
end;
$$;

-- ---------- الصلاحيات ----------

revoke all on function public.effective_plan_limit(uuid, text) from public, anon;
revoke all on function public.check_user_quota() from public, anon;
revoke all on function public.check_document_quota() from public, anon;
revoke all on function public.check_storage_quota(bigint) from public, anon;

grant execute on function public.check_user_quota() to authenticated;
grant execute on function public.check_document_quota() to authenticated;
grant execute on function public.check_storage_quota(bigint) to authenticated;
