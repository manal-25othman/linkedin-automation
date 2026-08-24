-- =====================================================================
-- اختبارات رموز الدعوة (0030)
--
-- الغرض من الرموز أن يبقى الباب مغلقًا على من لم يُدعَ. فالمُختبَر هنا
-- ثلاثة: أن يمرّ الصالح، وأن يُردّ غيرُه بكل صوره، وأن **لا يُقرأ
-- الجدول من متصفّح** — إذ قراءتُه تكشف الرموز كلها، وهي مفاتيح الباب.
-- =====================================================================

-- بيانات: رمز صالح، ومنتهٍ، وملغى، ومستنفَد
begin;

insert into public.invite_codes (id, code, label, max_uses, used_count, expires_at)
values
  ('cccccccc-0001-4000-8000-000000000001', 'TEST-VALID', 'شركة صالحة', 3, 0,
   now() + interval '30 days'),
  ('cccccccc-0001-4000-8000-000000000002', 'TEST-EXPIRED', 'شركة منتهية', 3, 0,
   now() - interval '1 day'),
  ('cccccccc-0001-4000-8000-000000000004', 'TEST-USEDUP', 'شركة مستنفَدة', 2, 2,
   now() + interval '30 days');

insert into public.invite_codes (id, code, label, max_uses, used_count, expires_at, revoked_at)
values
  ('cccccccc-0001-4000-8000-000000000003', 'TEST-REVOKED', 'شركة ملغاة', 3, 0,
   now() + interval '30 days', now());

commit;

-- =====================================================================
-- المجموعة 1 — التحقّق يقبل الصالح ويردّ غيره
-- =====================================================================

do $$
declare
  v_valid boolean;
begin
  select valid into v_valid from public.check_invite_code('TEST-VALID');
  insert into public.test_results (category, name, passed, detail)
  values ('الدعوات', 'الرمز الصالح يُقبَل (ضابط موجب)', v_valid, null);

  select valid into v_valid from public.check_invite_code('test-valid');
  insert into public.test_results (category, name, passed, detail)
  values ('الدعوات', 'حالة الأحرف لا تهمّ — «test-valid» يُقبَل كذلك', v_valid, null);

  select valid into v_valid from public.check_invite_code('  TEST-VALID  ');
  insert into public.test_results (category, name, passed, detail)
  values ('الدعوات', 'المسافات الزائدة تُقصّ — نسخٌ من رسالة لا يكسر الرمز', v_valid, null);

  select valid into v_valid from public.check_invite_code('TEST-EXPIRED');
  insert into public.test_results (category, name, passed, detail)
  values ('الدعوات', 'المنتهي يُردّ', not v_valid, null);

  select valid into v_valid from public.check_invite_code('TEST-REVOKED');
  insert into public.test_results (category, name, passed, detail)
  values ('الدعوات', 'الملغى يُردّ فورًا', not v_valid, null);

  select valid into v_valid from public.check_invite_code('TEST-USEDUP');
  insert into public.test_results (category, name, passed, detail)
  values ('الدعوات', 'المستنفَد يُردّ', not v_valid, null);

  select valid into v_valid from public.check_invite_code('LA-YUJAD');
  insert into public.test_results (category, name, passed, detail)
  values ('الدعوات', 'المجهول يُردّ', not v_valid, null);

  select valid into v_valid from public.check_invite_code('');
  insert into public.test_results (category, name, passed, detail)
  values ('الدعوات', 'الفارغ يُردّ', not v_valid, null);

  select valid into v_valid from public.check_invite_code(null);
  insert into public.test_results (category, name, passed, detail)
  values ('الدعوات', 'العدم يُردّ ولا يُسقط الاستعلام', not v_valid, null);
end $$;

-- التحقّق لا يستهلك — وإلا لأحرق خطأٌ في كلمة المرور دعوةً كاملة
do $$
declare
  v_used integer;
begin
  select used_count into v_used
  from public.invite_codes where code = 'TEST-VALID';

  insert into public.test_results (category, name, passed, detail)
  values ('الدعوات', 'التحقّق لا يستهلك الرمز', v_used = 0,
          'الاستعمال: ' || v_used::text || ' بعد تسعة فحوص');
end $$;

-- =====================================================================
-- المجموعة 2 — الاستهلاك يُنقص مرة واحدة ويتوقّف عند الحدّ
-- =====================================================================

do $$
declare
  v_ok    boolean;
  v_used  integer;
  v_count integer;
begin
  select public.redeem_invite_code('TEST-VALID', 'a@test.invalid') into v_ok;
  select used_count into v_used from public.invite_codes where code = 'TEST-VALID';

  insert into public.test_results (category, name, passed, detail)
  values ('الدعوات', 'الاستهلاك ينجح ويزيد العدّاد واحدًا',
          v_ok and v_used = 1, 'الاستعمال: ' || v_used::text);

  select count(*) into v_count
  from public.invite_redemptions r
  join public.invite_codes c on c.id = r.invite_id
  where c.code = 'TEST-VALID';

  insert into public.test_results (category, name, passed, detail)
  values ('الدعوات', 'يُسجَّل من استُعمل الرمز لأجله', v_count = 1, null);
end $$;

do $$
declare
  v_ok boolean;
begin
  -- الحدّ ثلاثة وقد استُعمل واحد؛ فاثنان يمرّان والرابع يُردّ
  select public.redeem_invite_code('TEST-VALID', 'b@test.invalid') into v_ok;
  select public.redeem_invite_code('TEST-VALID', 'c@test.invalid') into v_ok;
  select public.redeem_invite_code('TEST-VALID', 'd@test.invalid') into v_ok;

  insert into public.test_results (category, name, passed, detail)
  values ('الدعوات', 'الاستعمال بعد بلوغ الحدّ يُردّ', not v_ok, null);
end $$;

do $$
declare
  v_used integer;
begin
  select used_count into v_used from public.invite_codes where code = 'TEST-VALID';

  insert into public.test_results (category, name, passed, detail)
  values ('الدعوات', 'العدّاد لا يتجاوز الحدّ', v_used = 3,
          'الاستعمال: ' || v_used::text || ' من 3');
end $$;

do $$
declare
  v_ok boolean;
begin
  select public.redeem_invite_code('TEST-REVOKED', 'e@test.invalid') into v_ok;
  insert into public.test_results (category, name, passed, detail)
  values ('الدعوات', 'الملغى لا يُستهلك', not v_ok, null);

  select public.redeem_invite_code('TEST-EXPIRED', 'f@test.invalid') into v_ok;
  insert into public.test_results (category, name, passed, detail)
  values ('الدعوات', 'المنتهي لا يُستهلك', not v_ok, null);
end $$;

-- =====================================================================
-- المجموعة 3 — لا وصول من المتصفح
--
-- وهذه أهمّها: قراءة الجدول تكشف الرموز كلّها نصًّا صريحًا، فتُلغي
-- الحماية بالكامل دون أن يظهر أي خلل في أي مكان.
-- =====================================================================

begin;
set local role anon;

do $$
declare
  v_blocked boolean := false;
begin
  begin
    perform 1 from public.invite_codes limit 1;
  exception when insufficient_privilege then
    v_blocked := true;
  end;

  insert into public.test_results (category, name, passed, detail)
  values ('الدعوات', 'الزائر المجهول لا يقرأ جدول الرموز',
          v_blocked, 'قراءته تكشف كل الرموز نصًّا صريحًا');
end $$;

do $$
declare
  v_blocked boolean := false;
begin
  begin
    perform public.check_invite_code('TEST-VALID');
  exception when insufficient_privilege then
    v_blocked := true;
  end;

  insert into public.test_results (category, name, passed, detail)
  values ('الدعوات', 'الزائر المجهول لا يستدعي دالّة التحقّق',
          v_blocked, 'وإلا لجرّب الرموز واحدًا واحدًا بلا حدّ');
end $$;

do $$
declare
  v_blocked boolean := false;
begin
  begin
    perform public.redeem_invite_code('TEST-VALID', 'x@test.invalid');
  exception when insufficient_privilege then
    v_blocked := true;
  end;

  insert into public.test_results (category, name, passed, detail)
  values ('الدعوات', 'الزائر المجهول لا يستهلك رمزًا', v_blocked, null);
end $$;

do $$
declare
  v_blocked boolean := false;
begin
  begin
    insert into public.invite_codes (code, label, max_uses)
    values ('HACK-ME', 'مهاجم', 999);
  exception when insufficient_privilege then
    v_blocked := true;
  end;

  insert into public.test_results (category, name, passed, detail)
  values ('الدعوات', 'الزائر المجهول لا يُصدر رمزًا لنفسه', v_blocked, null);
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
    perform 1 from public.invite_codes limit 1;
  exception when insufficient_privilege then
    v_blocked := true;
  end;

  insert into public.test_results (category, name, passed, detail)
  values ('الدعوات', 'مدير الشركة لا يقرأ جدول الرموز', v_blocked, null);
end $$;

do $$
declare
  v_blocked boolean := false;
begin
  begin
    perform public.invite_codes_report();
  exception when others then
    v_blocked := true;
  end;

  insert into public.test_results (category, name, passed, detail)
  values ('الدعوات', 'مدير الشركة لا يقرأ تقرير الدعوات', v_blocked, null);
end $$;

commit;

-- ضابط موجب: مالك المنصّة يقرأ التقرير فعلًا
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-2000-4000-8000-000000000001"}';

do $$
declare
  v_rows integer;
begin
  select count(*) into v_rows from public.invite_codes_report();

  insert into public.test_results (category, name, passed, detail)
  values ('الدعوات', 'مالك المنصّة يقرأ التقرير (ضابط موجب)',
          v_rows >= 4, 'رموز: ' || v_rows::text);
end $$;

do $$
declare
  v_active boolean;
begin
  select is_active into v_active
  from public.invite_codes_report() where code = 'TEST-REVOKED';

  insert into public.test_results (category, name, passed, detail)
  values ('الدعوات', 'التقرير يميّز الفعّال من غيره', not v_active, null);
end $$;

commit;
