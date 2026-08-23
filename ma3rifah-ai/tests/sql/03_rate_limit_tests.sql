-- =====================================================================
-- اختبارات العدّاد المشترك لتحديد المعدّل (0027)
--
-- يُقاس هنا ما لا تستطيع اختبارات الوحدة قياسه: العدّاد نفسه على قاعدة
-- حقيقية. فاختبارات الوحدة تقيس المسار الاحتياطي في الذاكرة وحده، إذ
-- لا قاعدة فيها.
--
-- وأخطر ما يُختبر ليس الحدّ — الحدّ يظهر عطله بسرعة — بل:
--   • أن لا يستطيع متصفح استدعاء الدالة، فيرسل حدًّا هائلًا يتجاوز به
--     الحماية كلّها، أو يرسل مفتاح غيره فيغلق عليه بابه.
--   • أن لا تُفتح ثغرة حافة النافذة، وهي التي تسمح بضعف الحدّ في لحظة
--     التبديل — وهي ثغرة النافذة الثابتة الساذجة المعروفة.
-- =====================================================================

-- =====================================================================
-- المجموعة 1 — الحدّ يُطبَّق فعلًا
-- =====================================================================

do $$
declare
  v_allowed boolean;
  v_retry   integer;
  v_key     text := 'test:limit:' || gen_random_uuid()::text;
  v_i       integer;
  v_passed  boolean := true;
begin
  -- ثلاث محاولات ضمن حدّ ثلاثة: كلّها تمرّ
  for v_i in 1..3 loop
    select allowed into v_allowed
    from public.check_rate_limit(v_key, 3, 60000);
    if not v_allowed then v_passed := false; end if;
  end loop;

  insert into public.test_results (category, name, passed, detail)
  values ('تحديد المعدّل', 'ثلاث محاولات ضمن حدّ ثلاثة تمرّ', v_passed, null);

  -- الرابعة تُمنع، ومعها زمن انتظار موجب
  select allowed, retry_after_seconds into v_allowed, v_retry
  from public.check_rate_limit(v_key, 3, 60000);

  insert into public.test_results (category, name, passed, detail)
  values ('تحديد المعدّل', 'الرابعة تُمنع', not v_allowed,
          'allowed=' || v_allowed::text);

  insert into public.test_results (category, name, passed, detail)
  values ('تحديد المعدّل', 'زمن الانتظار موجب فيعرف المستخدم متى يعود',
          v_retry > 0, 'retry=' || v_retry::text);
end $$;

-- المفاتيح معزولة: امتلاء مفتاح لا يمنع غيره
do $$
declare
  v_a boolean;
  v_b boolean;
  v_key_a text := 'test:iso:a:' || gen_random_uuid()::text;
  v_key_b text := 'test:iso:b:' || gen_random_uuid()::text;
begin
  perform public.check_rate_limit(v_key_a, 1, 60000);
  select allowed into v_a from public.check_rate_limit(v_key_a, 1, 60000);
  select allowed into v_b from public.check_rate_limit(v_key_b, 1, 60000);

  insert into public.test_results (category, name, passed, detail)
  values ('تحديد المعدّل', 'مفتاح ممتلئ لا يمنع مفتاحًا آخر',
          (not v_a) and v_b, 'a=' || v_a::text || ' b=' || v_b::text);
end $$;

-- =====================================================================
-- المجموعة 2 — حافة النافذة
--
-- النافذة الثابتة الساذجة تسمح بضعف الحدّ: يستنفد المهاجم الحدّ في آخر
-- ثانية من نافذة، ثم يستنفده كاملًا في أول ثانية من التالية. والترجيح
-- بالنافذة السابقة هو ما يسدّ ذلك.
--
-- ويُزرع هنا صفُّ نافذةٍ سابقة ممتلئة بالكامل، ثم يُطلب طلبٌ واحد في
-- النافذة الحالية الفارغة: فلو كانت النافذة ثابتة ساذجة لمرّ.
-- =====================================================================

-- ولحظةُ التنفيذ هي كلّ شيء هنا: وزن النافذة السابقة يتناقص كلّما مضى
-- من الحالية، فاختبارٌ يجري في لحظة عشوائية يمرّ أو يسقط بالمصادفة.
-- ولذلك تُنتظر الحافة انتظارًا صريحًا. والنافذة ثانيتان لا دقيقة كي لا
-- يقف الاختبار دقيقة كاملة.

do $$
declare
  v_allowed  boolean;
  v_key      text := 'test:edge:' || gen_random_uuid()::text;
  v_window   double precision := 2.0;
  v_epoch    double precision;
  v_boundary double precision;
  v_start    timestamptz;
begin
  -- الانتظار إلى ما بعد أول حافة نافذة بقليل: فيصير المنقضي ≈ صفرًا
  -- ووزن النافذة السابقة ≈ واحدًا صحيحًا
  v_epoch    := extract(epoch from clock_timestamp());
  v_boundary := ceil(v_epoch / v_window) * v_window;
  perform pg_sleep(v_boundary - v_epoch + 0.05);

  v_start := to_timestamp(v_boundary);

  -- نافذة سابقة استُنفد فيها الحدّ كاملًا (عشرة من عشرة)
  insert into public.rate_limit_counters (key, window_start, hits)
  values (v_key, v_start - make_interval(secs => v_window), 10);

  select allowed into v_allowed
  from public.check_rate_limit(v_key, 10, 2000);

  insert into public.test_results (category, name, passed, detail)
  values ('تحديد المعدّل',
          'حافة النافذة مسدودة — نافذة سابقة ممتلئة تمنع الطلب التالي',
          not v_allowed,
          'لو مرّ لكان الحدّ الفعلي ضعف المعلن عند كل تبديل نافذة');
end $$;

-- والوزن حقيقي لا شكليّ: النافذة السابقة نفسها ممتلئةً لا تمنع شيئًا
-- إذا مضى أكثر النافذة الحالية. ولولا هذا الاختبار لَجاز أن يكون
-- «المنع» في الاختبار السابق منعًا مطلقًا لكل من سبقته نافذة ممتلئة —
-- وهو خطأ في الاتجاه المقابل يعاقب المستخدم البريء.
do $$
declare
  v_allowed  boolean;
  v_key      text := 'test:edge2:' || gen_random_uuid()::text;
  v_window   double precision := 2.0;
  v_epoch    double precision;
  v_start    timestamptz;
begin
  -- الانتظار إلى ٩٠٪ من النافذة الحالية
  v_epoch := extract(epoch from clock_timestamp());
  v_start := to_timestamp(floor(v_epoch / v_window) * v_window);
  perform pg_sleep(
    greatest(0.0, extract(epoch from v_start) + v_window * 0.9 - v_epoch)
  );

  insert into public.rate_limit_counters (key, window_start, hits)
  values (v_key, v_start - make_interval(secs => v_window), 10);

  select allowed into v_allowed
  from public.check_rate_limit(v_key, 10, 2000);

  insert into public.test_results (category, name, passed, detail)
  values ('تحديد المعدّل',
          'الوزن يتناقص — نافذة سابقة ممتلئة لا تمنع في آخر الحالية',
          v_allowed, null);
end $$;

-- ونافذة قديمة (خمس نوافذ للوراء) لا أثر لها البتة
do $$
declare
  v_allowed boolean;
  v_key     text := 'test:edge3:' || gen_random_uuid()::text;
  v_window  double precision := 60.0;
  v_start   timestamptz;
begin
  v_start := to_timestamp(floor(extract(epoch from clock_timestamp()) / v_window) * v_window);

  insert into public.rate_limit_counters (key, window_start, hits)
  values (v_key, v_start - make_interval(secs => v_window * 5), 100);

  select allowed into v_allowed
  from public.check_rate_limit(v_key, 10, 60000);

  insert into public.test_results (category, name, passed, detail)
  values ('تحديد المعدّل',
          'نافذة قديمة لا تُحتسب — فلا يُعاقَب المستخدم على أمسٍ مضى',
          v_allowed, null);
end $$;

-- =====================================================================
-- المجموعة 3 — لا وصول من المتصفح
--
-- هذه أهمّ اختبارات الملف. الدالة تأخذ الحدّ من مُستدعيها، فلو استطاع
-- متصفح استدعاءها لأرسل حدًّا هائلًا فتجاوز الحماية، أو أرسل مفتاح
-- ضحيةٍ فأغلق عليه بابه.
-- =====================================================================

begin;
set local role anon;

do $$
declare
  v_blocked boolean := false;
begin
  begin
    perform public.check_rate_limit('anyone', 999999, 60000);
  exception when insufficient_privilege then
    v_blocked := true;
  end;

  insert into public.test_results (category, name, passed, detail)
  values ('تحديد المعدّل', 'الزائر المجهول لا يستطيع استدعاء الدالة',
          v_blocked, null);
end $$;

do $$
declare
  v_blocked boolean := false;
begin
  begin
    perform 1 from public.rate_limit_counters limit 1;
  exception when insufficient_privilege then
    v_blocked := true;
  end;

  insert into public.test_results (category, name, passed, detail)
  values ('تحديد المعدّل', 'الزائر المجهول لا يقرأ جدول العدّادات',
          v_blocked, 'قراءته تكشف بريد كل من حاول الدخول');
end $$;

commit;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-2000-4000-8000-000000000001"}';

do $$
declare
  v_blocked boolean := false;
begin
  begin
    perform public.check_rate_limit('victim@example.com', 1, 60000);
  exception when insufficient_privilege then
    v_blocked := true;
  end;

  insert into public.test_results (category, name, passed, detail)
  values ('تحديد المعدّل',
          'المستخدم المسجَّل لا يستطيع استدعاء الدالة',
          v_blocked,
          'وإلا لأغلق باب دخول غيره بإرسال مفتاحه');
end $$;

do $$
declare
  v_blocked boolean := false;
begin
  begin
    perform 1 from public.rate_limit_counters limit 1;
  exception when insufficient_privilege then
    v_blocked := true;
  end;

  insert into public.test_results (category, name, passed, detail)
  values ('تحديد المعدّل', 'المستخدم المسجَّل لا يقرأ جدول العدّادات',
          v_blocked, null);
end $$;

commit;

-- =====================================================================
-- المجموعة 4 — المعاملات غير الصالحة تُرفض لا تُتجاهَل
--
-- حدٌّ صفريّ أو سالب يجب أن يرفع خطأً لا أن يمرّ صامتًا: تمريره يعني
-- أن خطأً برمجيًا في موضع النداء يُعطّل الحماية بلا أثر.
-- =====================================================================

do $$
declare
  v_raised boolean := false;
begin
  begin
    perform public.check_rate_limit('x', 0, 60000);
  exception when others then
    v_raised := true;
  end;

  insert into public.test_results (category, name, passed, detail)
  values ('تحديد المعدّل', 'حدّ صفريّ يرفع خطأً لا يمرّ صامتًا',
          v_raised, null);
end $$;

do $$
declare
  v_raised boolean := false;
begin
  begin
    perform public.check_rate_limit('x', 5, 0);
  exception when others then
    v_raised := true;
  end;

  insert into public.test_results (category, name, passed, detail)
  values ('تحديد المعدّل', 'نافذة صفرية ترفع خطأً', v_raised, null);
end $$;
