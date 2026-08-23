-- =====================================================================
-- 0027 — تحديد المعدّل في القاعدة بدل ذاكرة النسخة
--
-- الحدّ كان محفوظًا في `Map` داخل ذاكرة عملية Node. وهذا يعمل على خادم
-- واحد، والنشر على Vercel يشغّل نسخًا كثيرة متوازية لكلٍّ منها ذاكرتها.
-- فمن وُضع له حدّ ثماني محاولات دخول كل خمس دقائق يملك فعليًا ثمانيًا
-- **لكل نسخة**، والنسخ تزداد كلّما زاد الضغط — أي أن الحماية تضعف
-- بالضبط حين تُحتاج.
--
-- والأسوأ أن العطل صامت: لا خطأ ولا سجلّ، والحدّ يبدو مطبَّقًا في
-- الشيفرة تمامًا. ورشّ كلمات المرور يمرّ منه.
--
-- والمخزن هنا هو Postgres نفسه لا خدمة جديدة: لا مفتاح إضافي ولا تبعية
-- ولا فاتورة، والقاعدة مشتركة بين كل النسخ بحكم كونها قاعدة.
--
-- ---------------------------------------------------------------------
-- النافذة: ثابتة بتقدير انزلاقي
--
-- السجلّ الدقيق لكل طلب يعني صفًّا لكل طلب — كلفة كتابة ومسح لا داعي
-- لها. وبدلًا منه عدّاد واحد لكل (مفتاح، نافذة)، ويُقدَّر الانزلاق
-- بترجيح النافذة السابقة بما تبقّى منها:
--
--     المقدَّر = السابقة × (١ − المنقضي/الطول) + الحالية
--
-- فلا تُفتح ثغرة الحافة التي تسمح بضعف الحدّ عند تبديل النافذة، ولا
-- تُدفع كلفة السجلّ الكامل. وهي طريقة معروفة ومستقرّة عند هذا الحجم.
-- =====================================================================

create table if not exists public.rate_limit_counters (
  -- المفتاح يصنعه التطبيق: «auth-email:x@y.com»، «upload:<uuid>» …
  key          text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (key, window_start)
);

-- =====================================================================
-- لا وصول لأحد من المتصفح
--
-- الدالة تأخذ الحدّ وطول النافذة **من التطبيق**. فلو استطاع متصفح
-- استدعاءها لأرسل حدًّا هائلًا فتجاوز الحدّ كلّه، أو أرسل مفتاح غيره
-- فأغلق عليه بابه — أي أن أداة الحماية تصير أداة الهجوم.
--
-- ولذلك: لا صلاحية لـ anon ولا لـ authenticated. لا تُستدعى إلا من
-- الخادم بمفتاح الخدمة، وهو ما يمنع الأمرين معًا.
-- =====================================================================

alter table public.rate_limit_counters enable row level security;
revoke all on public.rate_limit_counters from anon, authenticated;

create or replace function public.check_rate_limit(
  p_key       text,
  p_limit     integer,
  p_window_ms integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_window     interval;
  v_seconds    double precision;
  v_epoch      double precision;
  v_start      timestamptz;
  v_prev_start timestamptz;
  v_hits       integer;
  v_prev_hits  integer;
  v_elapsed    double precision;
  v_estimated  double precision;
begin
  if p_key is null or p_limit is null or p_limit < 1
     or p_window_ms is null or p_window_ms < 1 then
    raise exception 'معاملات تحديد المعدّل غير صالحة';
  end if;

  v_seconds := p_window_ms / 1000.0;
  v_window  := make_interval(secs => v_seconds);

  -- بداية النافذة الحالية: تقريب زمن الآن لأسفل إلى مضاعف طول النافذة
  v_epoch      := extract(epoch from clock_timestamp());
  v_start      := to_timestamp(floor(v_epoch / v_seconds) * v_seconds);
  v_prev_start := v_start - v_window;

  -- الزيادة والقراءة في عبارة واحدة: ذرّية بحكم قيد المفتاح الأساسي،
  -- فطلبان متزامنان على نسختين مختلفتين لا يقرآن العدد نفسه ثم يكتبانه.
  insert into public.rate_limit_counters as c (key, window_start, hits)
  values (p_key, v_start, 1)
  on conflict (key, window_start)
    do update set hits = c.hits + 1
  returning c.hits into v_hits;

  select coalesce(c.hits, 0) into v_prev_hits
  from public.rate_limit_counters c
  where c.key = p_key and c.window_start = v_prev_start;

  v_prev_hits := coalesce(v_prev_hits, 0);
  v_elapsed   := v_epoch - extract(epoch from v_start);
  v_estimated := v_prev_hits * (1.0 - v_elapsed / v_seconds) + v_hits;

  -- كنس عرضي: صفوف النوافذ المنقضية لا تُقرأ أبدًا بعد نافذتين، ومسحها
  -- في واحد من كل مئة نداء يكفي لمنع التضخّم بلا كلفة على كل طلب.
  if random() < 0.01 then
    delete from public.rate_limit_counters
    where window_start < clock_timestamp() - (v_window * 3);
  end if;

  if v_estimated > p_limit then
    return query
      select false, greatest(1, ceil(v_seconds - v_elapsed)::integer);
  else
    return query select true, 0;
  end if;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer)
  to service_role;
