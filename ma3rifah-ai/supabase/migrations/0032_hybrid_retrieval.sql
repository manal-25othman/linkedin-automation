-- =====================================================================
-- البحث الهجين: دلاليّ + لفظيّ، مدموجان برتبة متبادلة
-- =====================================================================
-- العطل الذي دعا إليها:
--
-- كان الاسترجاع دلاليًّا صرفًا، وفيه أرضيةٌ صارمة داخل SQL:
--
--     and (1 - (c.embedding <=> p_query_embedding)) >= 0.30
--
-- فإن لم يبلغها أيّ مقطع رجعت الدالّة **صفر صفوف**، وقال المساعد «لم
-- أجد معلومات كافية» — والمعلومة في المستند أمام المستخدم.
--
-- ويقع هذا كثيرًا في حالتين:
--
--   • سؤالٌ عن المستند كلّه («ما ملخّص التعديلات») — لا يقابله مقطعٌ
--     واحد قريب، فالتشابه موزَّع على المستند لا مركَّز في مقطع.
--
--   • سؤالٌ بمصطلح حرفيّ — اسم نظام، رقم مادة، رقم قرار. والمتجهات
--     تلتقط المعنى وتُضعف الحرف، فيضيع ما كان أسهل ما يُلتقط.
--
-- والعلاج ليس خفض الأرضية وحدها: ذلك يُدخل ضجيجًا في كل سؤال. بل
-- إضافة مسارٍ ثانٍ يلتقط ما يفوت الأول، ثم دمجهما.
--
-- ولمَ لا مكتبة بحث خارجية: القاعدة نفسها تملك الفهرسة النصّية، وأي
-- خدمة ثانية تعني نسخةً ثانية من البيانات تُزامَن وتُؤمَّن وتُعزَل —
-- وعزل المستأجرين هنا مبنيّ على `auth.uid()` داخل القاعدة، ونقلُه
-- خارجها أخطر ما يمكن فعله بهذا المنتج.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ١) تطبيع عربيّ داخل القاعدة
-- ---------------------------------------------------------------------
-- لا يملك PostgreSQL قاموسًا عربيًّا، فالتقطيع بـ`simple`: يفصل على
-- غير الحروف ولا يجذّر. وهو المطلوب هنا — نريد مطابقة اللفظ لا اشتقاقه.
--
-- لكنّ العربية تُكتب بصور متعدّدة للحرف الواحد: «الإدارة» و«الادارة»،
-- «مسؤولية» و«مسئولية»، و«علي» و«على». فبلا تطبيع يفشل البحث اللفظيّ
-- على فروقٍ لا يقصدها كاتب ولا قارئ.
--
-- والدالّة IMMUTABLE كي تصلح لعمود مولَّد وفهرس.
create or replace function public.ar_normalize(p_text text)
returns text
language sql
immutable
parallel safe
as $$
  select regexp_replace(
    translate(
      -- تُزال الحركات والتطويل أولًا
      regexp_replace(lower(coalesce(p_text, '')), '[ً-ٰٟـ]', '', 'g'),
      -- الألف بأشكالها ⇒ ا · الألف المقصورة ⇒ ي · التاء المربوطة ⇒ ه
      --
      -- وكرسيّ الهمزة يُطوى إلى الهمزة نفسها لا إلى حرفٍ آخر: «مسؤولية»
      -- و«مسئولية» كلمة واحدة يكتبها الناس بكرسيّين، ولو صارت الأولى
      -- «مسوولية» والثانية «مسيولية» لتباعدتا بدل أن تتّحدا.
      'أإآٱىةؤئ',
      'اااايهءء'
    ),
    '\s+', ' ', 'g'
  );
$$;

-- ---------------------------------------------------------------------
-- تجريد أداة التعريف
-- ---------------------------------------------------------------------
-- `simple` لا يجذّر، فـ«التعديلات» و«تعديلات» رمزان مختلفان لا يلتقيان.
-- والمستخدم يكتب أحدهما والمستند يحمل الآخر، فيفشل البحث على أداةِ
-- تعريفٍ لا تغيّر المعنى.
--
-- والتجريد مشروط بأن يبقى بعدها ثلاثة أحرف فأكثر، كيلا تُمَسّ كلمةٌ
-- أصلها يبدأ بهما مثل «ألم» و«الله».
create or replace function public.ar_stem(p_text text)
returns text
language sql
immutable
parallel safe
as $$
  select regexp_replace(public.ar_normalize(p_text), '(^| )ال(...)', '\1\2', 'g');
$$;

comment on function public.ar_normalize(text) is
  'تطبيع عربيّ للبحث اللفظيّ: حركات وتطويل وصور الألف والياء والتاء.';

-- ---------------------------------------------------------------------
-- ٢) عمود الفهرسة النصّية
-- ---------------------------------------------------------------------
-- مولَّد ومخزَّن: يُحسب مرّة عند الكتابة لا في كل استعلام، ويبقى
-- متّسقًا مع `content` بلا مشغّل يُصان.
-- يُسقَط ثم يُنشأ، لا `if not exists`.
--
-- العمود المولَّد يُحسب وقت الكتابة، فلو تغيّرت `ar_normalize` يومًا
-- وبقي العمود لظلّت المتجهات النصّية محسوبةً بالتطبيع القديم — ولا
-- يشكو أحد: الفهرس موجود والاستعلام ينجح، لكنه يبحث في نصٍّ مطبَّع
-- بقاعدةٍ غير التي يُطبَّع بها السؤال. فيفشل البحث اللفظيّ صامتًا.
--
-- والإسقاط هنا رخيص: العمود مشتقّ بالكامل، ولا يُفقد به شيء.
alter table public.document_chunks drop column if exists content_tsv;

alter table public.document_chunks
  add column content_tsv tsvector
  generated always as (to_tsvector('simple', public.ar_stem(content))) stored;

create index if not exists document_chunks_content_tsv_idx
  on public.document_chunks using gin (content_tsv);

-- ---------------------------------------------------------------------
-- ٣) الاسترجاع الهجين
-- ---------------------------------------------------------------------
-- الدمج برتبةٍ متبادلة (Reciprocal Rank Fusion):
--
--     score(c) = Σ  1 / (k + rank_i(c))
--
-- ويُختار الدمج بالرتبة لا بالدرجة لأن الدرجتين غير متجانستين: تشابه
-- الجيب التمام في [0,1]، ورتبة ts_rank مفتوحة وتتبع طول النصّ. وجمعُ
-- مقياسين بوحدتين مختلفتين يعطي رقمًا لا معنى له.
--
-- و k = 60 هي القيمة المتعارفة: تخفّف أثر المراكز الأولى فلا يحتكر
-- مسارٌ واحد النتيجة.
--
-- ملاحظة أمنية — لم يتغيّر شيء منها:
-- الشركة والدور والقسم تُشتقّ من `auth.uid()` داخل الدالّة، ولا
-- يمرّرها العميل. ونطاق الرؤية في المسارين واحد، فلا يفتح المسار
-- اللفظيّ بابًا يغلقه الدلاليّ.
create or replace function public.match_document_chunks_hybrid(
  p_query_embedding vector(1024),
  p_query_text      text,
  p_match_count     int default 20,
  p_min_similarity  real default 0.05,
  p_category_ids    uuid[] default null
)
returns table (
  chunk_id       uuid,
  document_id    uuid,
  document_name  text,
  content        text,
  page_number    int,
  section_title  text,
  similarity     real,
  lexical_rank   real,
  fused_score    real,
  matched_by     text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_role    public.user_role;
  v_dept    uuid;
  v_query   tsquery;
  v_terms   text;
  k         constant int := 60;
  -- بركةٌ أوسع من المطلوب: الدمج يحتاج مرشّحين ليرتّبهم
  v_pool    int := greatest(p_match_count * 3, 30);
begin
  select company_id, role, department_id
    into v_company, v_role, v_dept
  from public.profiles
  where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    return;
  end if;

  -- استعلام لفظيّ بـ«أو» لا «و».
  --
  -- `websearch_to_tsquery` و`plainto_tsquery` كلاهما يربط الكلمات
  -- بـAND، فسؤال «ما ملخص التعديلات على نظام العمل» يشترط ورود
  -- «ملخص» في المقطع — وهي كلمة السائل لا كلمة المستند. فلا يُطابَق
  -- شيء، ويعود المسار اللفظيّ خاوياً كالدلاليّ.
  --
  -- والترتيب هو ما يفرز هنا لا الشرط: تُجمَع الكلمات بـ«أو»، ثم
  -- يرفع `ts_rank` ما اجتمع فيه أكثرها.
  select coalesce(string_agg(distinct w, ' | '), '')
    into v_terms
  from unnest(
         string_to_array(
           regexp_replace(public.ar_stem(p_query_text), '[^[:alnum:] ]+', ' ', 'g'),
           ' '
         )
       ) as w
  where length(w) >= 2;

  if v_terms = '' then
    v_query := null;
  else
    begin
      v_query := to_tsquery('simple', v_terms);
    exception when others then
      v_query := plainto_tsquery('simple', public.ar_stem(p_query_text));
    end;
  end if;

  return query
  with visible as (
    select c.id, c.document_id, c.content, c.page_number, c.section_title,
           c.embedding, c.content_tsv, d.name as document_name
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    -- شروط الرؤية منسوخة حرفًا بحرف من `match_document_chunks`.
    -- ولا يُجتهد فيها: مسارٌ ثانٍ بقواعد رؤية مختلفة — ولو باختلافٍ
    -- يسير — يفتح على المستأجرين بابًا يغلقه الأول، وهو أخطر ما يمكن
    -- أن يقع في هذا المنتج.
    where c.company_id = v_company
      and d.company_id = v_company
      and d.status = 'READY'
      and c.embedding is not null
      and (p_category_ids is null or d.category_id = any (p_category_ids))
      and (
        v_role = 'COMPANY_ADMIN'
        or d.visibility = 'COMPANY'
        or (d.visibility = 'DEPARTMENT'
            and v_dept is not null
            and v_dept = any (d.allowed_department_ids))
        or (d.visibility = 'ROLE' and v_role = any (d.allowed_roles))
      )
  ),
  dense as (
    select v.id,
           (1 - (v.embedding <=> p_query_embedding))::real as sim,
           row_number() over (order by v.embedding <=> p_query_embedding) as rnk
    from visible v
    where (1 - (v.embedding <=> p_query_embedding)) >= p_min_similarity
    order by v.embedding <=> p_query_embedding
    limit v_pool
  ),
  sparse as (
    select v.id,
           ts_rank(v.content_tsv, v_query)::real as rank,
           row_number() over (order by ts_rank(v.content_tsv, v_query) desc) as rnk
    from visible v
    where v_query is not null and v.content_tsv @@ v_query
    order by ts_rank(v.content_tsv, v_query) desc
    limit v_pool
  ),
  fused as (
    select coalesce(d.id, s.id) as id,
           coalesce(d.sim, 0)::real  as sim,
           coalesce(s.rank, 0)::real as rank,
           (coalesce(1.0 / (k + d.rnk), 0) + coalesce(1.0 / (k + s.rnk), 0))::real as score,
           case
             when d.id is not null and s.id is not null then 'both'
             when d.id is not null then 'dense'
             else 'sparse'
           end as matched_by
    from dense d
    full outer join sparse s on s.id = d.id
  )
  select v.id, v.document_id, v.document_name, v.content, v.page_number,
         v.section_title, f.sim, f.rank, f.score, f.matched_by
  from fused f
  join visible v on v.id = f.id
  order by f.score desc, f.sim desc
  limit p_match_count;
end;
$$;

revoke all on function public.match_document_chunks_hybrid(vector, text, int, real, uuid[]) from public;
grant execute on function public.match_document_chunks_hybrid(vector, text, int, real, uuid[])
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- ٤) الأرضية المخزَّنة — وبلا هذا القسم لا أثر لكل ما سبق
-- ---------------------------------------------------------------------
-- `min_similarity` ليست قيمةً في الشيفرة بل حقلٌ في `companies.ai_settings`
-- يُكتب عند إنشاء الشركة. فتغييرُ الافتراض في TypeScript لا يمسّ شركةً
-- قائمة: صفّها يحمل 0.30 وسيبقى يحملها.
--
-- وهذا أخبث ما في هذا الإصلاح: الشيفرة تبدو مصلَحة، والاختبارات تمرّ،
-- والإنتاج يتصرّف كما كان — ولا أحد يعرف لماذا.
--
-- ولا تُلمس قيمةٌ اختارها عميل: الشرط على 0.30 وحدها، وهي الافتراض
-- الذي لم يمسّه أحد. ومن ضبطها يدويًّا يبقى ضبطُه.

alter table public.companies
  alter column ai_settings set default jsonb_build_object(
    'tone', 'professional',
    'retrieval_top_k', 8,
    'min_similarity', 0.05,
    'max_context_chunks', 6,
    'history_window', 6,
    'allow_general_knowledge', false
  );

update public.companies
   set ai_settings = jsonb_set(ai_settings, '{min_similarity}', '0.05'::jsonb),
       updated_at  = now()
 where (ai_settings ->> 'min_similarity')::numeric = 0.30;
