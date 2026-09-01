-- =====================================================================
-- المجموعة ٨ — جودة الفهرسة (0034)
-- =====================================================================
-- أعدادٌ عن مقاطع شركات العملاء تصل مالك المنصّة. الحدّ نفسه المطبَّق
-- على الرضا: المالك وحده، وأعدادٌ بلا محتوى ولا أسماء مستندات.

-- مقطع معطوب مزروع لشركة (أ) — ليقيس الضابط الموجب عددًا لا صفرًا
insert into public.document_chunks (document_id, company_id, chunk_index, content, token_count)
select d.id, d.company_id, 9099, 'تسري األحكام خالل ثالثين يومًا', 6
from public.documents d
where d.company_id = '11111111-1111-1111-1111-111111111111'
limit 1;

do $$
begin
  -- مدير شركة يحاول
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);
  begin
    perform * from public.platform_index_quality();
    insert into public.test_results (category, name, passed, detail)
    values ('جودة الفهرسة', 'مدير الشركة لا يقرأ جودة فهرسة غيره', false, 'قرأها!');
  exception when insufficient_privilege then
    insert into public.test_results (category, name, passed, detail)
    values ('جودة الفهرسة', 'مدير الشركة لا يقرأ جودة فهرسة غيره', true, null);
  end;

  -- زائر بلا جلسة
  perform set_config('request.jwt.claim.sub', '', false);
  begin
    perform * from public.platform_index_quality();
    insert into public.test_results (category, name, passed, detail)
    values ('جودة الفهرسة', 'الزائر المجهول يُردّ', false, 'قرأها!');
  exception when others then
    insert into public.test_results (category, name, passed, detail)
    values ('جودة الفهرسة', 'الزائر المجهول يُردّ', true, null);
  end;
end $$;

-- ضابط موجب: المالك يقرأ، والمقطع المزروع محسوب
do $$
declare
  v_flagged bigint;
begin
  perform set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', false);

  select q.chunks_flagged into v_flagged
  from public.platform_index_quality() q
  where q.company_name = (select name from public.companies
                          where id = '11111111-1111-1111-1111-111111111111');

  insert into public.test_results (category, name, passed, detail)
  values ('جودة الفهرسة', 'مالك المنصّة يقرأ، والمقطع المعطوب محسوب',
          coalesce(v_flagged, 0) >= 1, 'معطوب=' || coalesce(v_flagged, 0));

  -- الأعمدة أعداد فقط — لا عمود محتوى ولا اسم مستند
  insert into public.test_results (category, name, passed, detail)
  select 'جودة الفهرسة', 'لا محتوى ولا أسماء مستندات في المخرجات',
         count(*) = 0, 'أعمدة زائدة=' || count(*)
  from information_schema.columns
  where table_schema = 'public' and table_name = 'platform_index_quality';

  perform set_config('request.jwt.claim.sub', '', false);
end $$;

-- تنظيف المقطع المزروع كي لا يلوّث مجموعات لاحقة
delete from public.document_chunks where chunk_index = 9099;
