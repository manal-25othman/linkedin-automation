-- =====================================================================
-- 0030 — التسجيل بدعوة: بابٌ يُفتح لمن دُعي وحده
--
-- التسجيل مفتوح للعالم اليوم. وفي مرحلة التجربة هذا خطر مباشر: يكفي
-- أن يشارك مجرِّبٌ الرابطَ في مجموعة واحدة حتى تُنشأ حسابات لا تعرفها
-- المالكة ولم توقّع اتفاقية، تستهلك من رصيد النموذج بلا مقابل، وتُفسد
-- قياس التحويل — إذ لا يُعرف من جاء بدعوة ومن تسرّب.
--
-- والحلّ الشائع — إخفاء الرابط — ليس حلًّا: الرابط يُكتشف، وصفحة
-- `/register` قائمة في البناء سواء رُبط إليها أم لا.
--
-- ---------------------------------------------------------------------
-- ما يمنع الالتفاف
--
--   • **الرمز يُتحقَّق منه على الخادم** لا في الواجهة، وداخل دالّةٍ
--     في القاعدة لا في شيفرة التطبيق وحدها.
--
--   • **العدّ ذرّي بقفل الصفّ**: بلا قفل يستطيع طلبان متزامنان أن
--     يقرآ «بقي واحد» معًا فيمرّان معًا — وهو أوّل ما يُستغلّ في رمزٍ
--     يُشارَك.
--
--   • **الاستهلاك يُسجَّل عند نجاح التسجيل لا قبله**: لو عُدّ عند
--     التحقّق لَأحرق خطأٌ في كلمة المرور دعوةً كاملة.
--
--   • لا صلاحية لأحد على الجدول من المتصفح: قراءتُه تكشف الرموز كلها،
--     وهي مفاتيح الباب.
-- =====================================================================

create table if not exists public.invite_codes (
  id          uuid primary key default gen_random_uuid(),
  -- الرمز كما يُكتب: حروف لاتينية وأرقام وشرطات، غير حسّاس للحالة
  code        text        not null,
  -- لمن أُصدر — اسم الشركة أو الشخص، للتتبّع لا للتحقّق
  label       text        not null check (length(trim(label)) between 2 and 120),
  max_uses    integer     not null default 1 check (max_uses between 1 and 500),
  used_count  integer     not null default 0 check (used_count >= 0),
  expires_at  timestamptz,
  revoked_at  timestamptz,
  note        text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- التفرّد على الصيغة الصغيرة: «ALFA-2026» و«alfa-2026» رمز واحد،
-- وإلا لأُصدر رمزان متطابقان في نظر المستخدم ومختلفان في نظر القاعدة.
create unique index if not exists invite_codes_code_key
  on public.invite_codes (lower(code));

alter table public.invite_codes enable row level security;
revoke all on public.invite_codes from anon, authenticated;

-- =====================================================================
-- من استُعمل الرمز لأجله — سجلّ لا يُحذف
--
-- يربط كل شركة أُنشئت بالدعوة التي أُنشئت بها، فيُعرف مصدر كل حساب.
-- وبلا هذا الربط يبقى السؤال «من أين جاء هذا الحساب؟» بلا جواب.
-- =====================================================================

create table if not exists public.invite_redemptions (
  id          uuid primary key default gen_random_uuid(),
  invite_id   uuid not null references public.invite_codes(id) on delete cascade,
  company_id  uuid references public.companies(id) on delete set null,
  user_id     uuid references public.profiles(id) on delete set null,
  email       text not null,
  redeemed_at timestamptz not null default now()
);

create index if not exists invite_redemptions_invite_idx
  on public.invite_redemptions (invite_id);

alter table public.invite_redemptions enable row level security;
revoke all on public.invite_redemptions from anon, authenticated;

-- =====================================================================
-- التحقّق وحده — بلا استهلاك
--
-- يُنادى قبل إنشاء الحساب ليُعرض الخطأ مبكرًا. ولا يُنقص العدّاد: خطأٌ
-- في كلمة المرور بعده كان سيحرق دعوةً كاملة.
--
-- ولا يعيد إلا سببًا مختصرًا: تفصيلُ «منتهٍ» و«مستنفَد» و«ملغى» يعطي
-- من يجرّب رموزًا عشوائية إشارةً على أن رمزًا ما كان صحيحًا يومًا.
-- =====================================================================

create or replace function public.check_invite_code(p_code text)
returns table (valid boolean, label text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.invite_codes%rowtype;
begin
  if p_code is null or length(trim(p_code)) = 0 then
    return query select false, null::text;
    return;
  end if;

  select * into v_row
  from public.invite_codes c
  where lower(c.code) = lower(trim(p_code));

  if not found
     or v_row.revoked_at is not null
     or (v_row.expires_at is not null and v_row.expires_at <= now())
     or v_row.used_count >= v_row.max_uses then
    return query select false, null::text;
    return;
  end if;

  return query select true, v_row.label;
end;
$$;

revoke all on function public.check_invite_code(text) from public, anon, authenticated;
grant execute on function public.check_invite_code(text) to service_role;

-- =====================================================================
-- الاستهلاك — ذرّيّ
--
-- `for update` يقفل الصفّ حتى نهاية المعاملة، فلا يقرأ طلبان متزامنان
-- العدّاد نفسه. وبلا القفل يمرّ اثنان على آخر استعمال — وهو أوّل ما
-- يُستغلّ حين يُشارَك رمزٌ في مجموعة.
-- =====================================================================

create or replace function public.redeem_invite_code(
  p_code       text,
  p_email      text,
  p_company_id uuid default null,
  p_user_id    uuid default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_row public.invite_codes%rowtype;
begin
  select * into v_row
  from public.invite_codes c
  where lower(c.code) = lower(trim(coalesce(p_code, '')))
  for update;

  if not found
     or v_row.revoked_at is not null
     or (v_row.expires_at is not null and v_row.expires_at <= now())
     or v_row.used_count >= v_row.max_uses then
    return false;
  end if;

  update public.invite_codes
  set used_count = used_count + 1
  where id = v_row.id;

  insert into public.invite_redemptions (invite_id, company_id, user_id, email)
  values (v_row.id, p_company_id, p_user_id, lower(trim(p_email)));

  return true;
end;
$$;

revoke all on function public.redeem_invite_code(text, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.redeem_invite_code(text, text, uuid, uuid)
  to service_role;

-- =====================================================================
-- تقرير الدعوات لمالك المنصّة
-- =====================================================================

create or replace function public.invite_codes_report()
returns table (
  id          uuid,
  code        text,
  label       text,
  max_uses    integer,
  used_count  integer,
  expires_at  timestamptz,
  revoked_at  timestamptz,
  note        text,
  created_at  timestamptz,
  is_active   boolean
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
    c.id, c.code, c.label, c.max_uses, c.used_count,
    c.expires_at, c.revoked_at, c.note, c.created_at,
    c.revoked_at is null
      and (c.expires_at is null or c.expires_at > now())
      and c.used_count < c.max_uses
  from public.invite_codes c
  order by c.created_at desc;
end;
$$;

revoke all on function public.invite_codes_report() from public, anon;
grant execute on function public.invite_codes_report() to authenticated;
