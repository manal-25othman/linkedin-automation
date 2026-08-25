-- =====================================================================
-- اختبارات الاسترجاع الهجين (0032)
--
-- العطل الذي دعا إليها ظهر عند مستخدمة: مستندٌ من صفحة واحدة، مفهرسٌ
-- سليمًا، وسؤالٌ إجابته فيه حرفيًّا — والمساعد يقول «لم أجد معلومات
-- كافية».
--
-- والسبب أرضيةٌ صارمة في SQL: كل مقطع تشابهه دون 0.30 يُحذف قبل أن
-- يراه أحد. فإن لم يبلغها أيّ مقطع رجعت الدالّة صفر صفوف — والمساعد
-- صادقٌ حين يقول «لم أجد»، لكنّ العطل وقع قبله.
--
-- فالمُختبَر هنا ثلاثة:
--   ١) أن المسار اللفظيّ ينقذ ما يُسقطه الدلاليّ (وهو أصل العطل).
--   ٢) أن التطبيع العربيّ يوحّد صور الحرف.
--   ٣) أن العزل لم يُفتَح بالمسار الجديد — وهذا أخطرها.
-- =====================================================================

begin;

insert into public.companies (id, name, slug, status) values
  ('11111111-1111-1111-1111-111111111111','شركة أ','hybrid-a','ACTIVE'),
  ('22222222-2222-2222-2222-222222222222','شركة ب','hybrid-b','ACTIVE');

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','hybrid-a@test.local'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','hybrid-b@test.local');

insert into public.profiles (id, company_id, email, full_name, role, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','hybrid-a@test.local','مستخدم أ','COMPANY_ADMIN','ACTIVE'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','22222222-2222-2222-2222-222222222222','hybrid-b@test.local','مستخدم ب','COMPANY_ADMIN','ACTIVE')
on conflict (id) do update
  set company_id = excluded.company_id, role = excluded.role, status = excluded.status;

insert into public.documents (id, company_id, name, file_type, storage_path, status, visibility, uploaded_by) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd','11111111-1111-1111-1111-111111111111','تعديلات نظام العمل','pdf','a/1.pdf','READY','COMPANY','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','22222222-2222-2222-2222-222222222222','مستند شركة ب','pdf','b/1.pdf','READY','COMPANY','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- متجهٌ متعامدٌ على متجه السؤال عمدًا: التشابه صفر، فلا يمرّ من الأرضية
-- الدلالية أبدًا. وهكذا نعزل أثر المسار اللفظيّ وحده.
insert into public.document_chunks
  (company_id, document_id, chunk_index, content, token_count, page_number, embedding)
values
  ('11111111-1111-1111-1111-111111111111','dddddddd-dddd-dddd-dddd-dddddddddddd',0,
   'تعديلات نظام العمل الصادرة بقرار مجلس الوزراء: عُدّلت المادة الرابعة والسبعون، وأُضيفت مهلة إشعار قدرها ثلاثون يومًا.',
   40, 1,
   ('[' || array_to_string(array(select case when i = 5 then 1.0 else 0.0 end from generate_series(1,1024) i), ',') || ']')::vector),
  ('22222222-2222-2222-2222-222222222222','eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',0,
   'تعديلات نظام العمل نسخة شركة ب السرّية، ومهلة إشعارها ستون يومًا.',
   30, 1,
   ('[' || array_to_string(array(select case when i = 5 then 1.0 else 0.0 end from generate_series(1,1024) i), ',') || ']')::vector);

commit;

-- =====================================================================
-- المجموعة ١ — الضابط السالب: الدالّة القديمة تفشل على هذه الحالة
-- =====================================================================
do $$
declare
  v_rows int;
  v_query vector(1024);
begin
  v_query := ('[' || array_to_string(array(select case when i = 900 then 1.0 else 0.0 end from generate_series(1,1024) i), ',') || ']')::vector;
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);

  select count(*) into v_rows
  from public.match_document_chunks(v_query, 8, 0.30, null);

  -- العطل الأصلي: صفر صفوف رغم أن الإجابة في المستند
  insert into public.test_results (category, name, passed, detail)
  values ('الهجين', 'الدلاليّ وحده يُرجع صفرًا (إعادة إنتاج العطل)', v_rows = 0,
          'rows=' || v_rows);
end $$;

-- =====================================================================
-- المجموعة ٢ — المسار اللفظيّ ينقذ الحالة نفسها
-- =====================================================================
do $$
declare
  v_rows int;
  v_by text;
  v_query vector(1024);
begin
  v_query := ('[' || array_to_string(array(select case when i = 900 then 1.0 else 0.0 end from generate_series(1,1024) i), ',') || ']')::vector;
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);

  select count(*), min(matched_by) into v_rows, v_by
  from public.match_document_chunks_hybrid(v_query, 'ما ملخص التعديلات على نظام العمل؟', 8, 0.05, null);

  insert into public.test_results (category, name, passed, detail)
  values ('الهجين', 'الهجين يجد المقطع الذي أسقطه الدلاليّ', v_rows >= 1,
          'rows=' || v_rows || ' matched_by=' || coalesce(v_by,'—'));

  insert into public.test_results (category, name, passed, detail)
  values ('الهجين', 'المصدر لفظيّ لا دلاليّ (يثبت أن المنقذ هو المسار الجديد)',
          v_by = 'sparse', 'matched_by=' || coalesce(v_by,'—'));
end $$;

-- =====================================================================
-- المجموعة ٣ — التطبيع العربيّ
-- =====================================================================
do $$
declare
  v_rows int;
  v_query vector(1024);
begin
  v_query := ('[' || array_to_string(array(select case when i = 900 then 1.0 else 0.0 end from generate_series(1,1024) i), ',') || ']')::vector;
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);

  -- «الاشعار» بلا همزة، والمخزَّن «إشعار» بها
  select count(*) into v_rows
  from public.match_document_chunks_hybrid(v_query, 'مهلة الاشعار', 8, 0.05, null);

  insert into public.test_results (category, name, passed, detail)
  values ('الهجين', 'صور الهمزة لا تمنع المطابقة', v_rows >= 1, 'rows=' || v_rows);

  -- تشكيل في السؤال
  select count(*) into v_rows
  from public.match_document_chunks_hybrid(v_query, 'نِظَامُ العَمَل', 8, 0.05, null);

  insert into public.test_results (category, name, passed, detail)
  values ('الهجين', 'التشكيل في السؤال لا يمنع المطابقة', v_rows >= 1, 'rows=' || v_rows);
end $$;

-- =====================================================================
-- المجموعة ٤ — العزل: أخطر ما في هذه الترحيلة
-- =====================================================================
do $$
declare
  v_other int;
  v_query vector(1024);
begin
  v_query := ('[' || array_to_string(array(select case when i = 900 then 1.0 else 0.0 end from generate_series(1,1024) i), ',') || ']')::vector;

  -- شركة أ تسأل سؤالًا يطابق مقطع شركة ب لفظيًّا مطابقةً تامّة
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);

  select count(*) into v_other
  from public.match_document_chunks_hybrid(v_query, 'نسخة شركة ب السرّية ستون يومًا', 20, 0.0, null)
  where document_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

  insert into public.test_results (category, name, passed, detail)
  values ('الهجين', 'المسار اللفظيّ لا يسرّب مقاطع شركة أخرى', v_other = 0,
          'تسرّب=' || v_other);

  -- والعكس
  perform set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false);

  select count(*) into v_other
  from public.match_document_chunks_hybrid(v_query, 'مهلة إشعار ثلاثون يومًا مجلس الوزراء', 20, 0.0, null)
  where document_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

  insert into public.test_results (category, name, passed, detail)
  values ('الهجين', 'العزل في الاتجاه المعاكس أيضًا', v_other = 0, 'تسرّب=' || v_other);
end $$;

-- =====================================================================
-- المجموعة ٥ — بلا جلسة لا نتائج
-- =====================================================================
do $$
declare
  v_rows int;
  v_query vector(1024);
begin
  v_query := ('[' || array_to_string(array(select case when i = 900 then 1.0 else 0.0 end from generate_series(1,1024) i), ',') || ']')::vector;
  perform set_config('request.jwt.claim.sub', '', false);

  select count(*) into v_rows
  from public.match_document_chunks_hybrid(v_query, 'نظام العمل', 20, 0.0, null);

  insert into public.test_results (category, name, passed, detail)
  values ('الهجين', 'زائر بلا ملف تعريف لا يرى شيئًا', v_rows = 0, 'rows=' || v_rows);
end $$;

-- =====================================================================
-- المجموعة ٦ — الأرضية المخزَّنة تُهاجَر فعلًا
-- =====================================================================
-- بلا هذه الهجرة يبقى صفّ كل شركة قائمة حاملًا 0.30، فلا أثر لكل ما
-- سبق مهما تغيّرت الشيفرة.
do $$
declare
  v_left int;
  v_new  numeric;
begin
  select count(*) into v_left
  from public.companies
  where (ai_settings ->> 'min_similarity')::numeric = 0.30;

  insert into public.test_results (category, name, passed, detail)
  values ('الهجين', 'لا شركة بقيت على الأرضية القديمة 0.30', v_left = 0,
          'باقٍ=' || v_left);

  select (ai_settings ->> 'min_similarity')::numeric into v_new
  from public.companies
  where id = '11111111-1111-1111-1111-111111111111';

  insert into public.test_results (category, name, passed, detail)
  values ('الهجين', 'الأرضية الجديدة مطبَّقة على الشركات القائمة', v_new = 0.05,
          'القيمة=' || coalesce(v_new::text, '—'));
end $$;

-- ضابط سالب: قيمةٌ اختارها عميل لا تُمَسّ
do $$
declare
  v_kept numeric;
begin
  insert into public.companies (id, name, slug, status, ai_settings)
  values ('33333333-3333-3333-3333-333333333333','شركة ضبطت يدويًّا','tuned','ACTIVE',
          jsonb_build_object('tone','professional','retrieval_top_k',8,
                             'min_similarity',0.45,'max_context_chunks',6,
                             'history_window',6,'allow_general_knowledge',false));

  update public.companies
     set ai_settings = jsonb_set(ai_settings, '{min_similarity}', '0.05'::jsonb)
   where (ai_settings ->> 'min_similarity')::numeric = 0.30;

  select (ai_settings ->> 'min_similarity')::numeric into v_kept
  from public.companies where id = '33333333-3333-3333-3333-333333333333';

  insert into public.test_results (category, name, passed, detail)
  values ('الهجين', 'ضبطٌ يدويّ من العميل لا يُداس عليه', v_kept = 0.45,
          'القيمة=' || coalesce(v_kept::text,'—'));
end $$;
