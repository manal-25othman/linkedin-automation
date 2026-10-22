-- =====================================================================
-- 0045 — جعل الرفع المرجعي قابلًا للتحقق
--
-- العطل ليس في الفهرسة بل في **انعدام الدليل عليها**: تُرفع وثيقة
-- نظامية، تقول اللوحة «منشورة»، ولا سبيل إلى معرفة ما فُهرس فعلًا.
-- والطريق الوحيد للتأكد اليوم هو فتح استوديو السياسات وتجربة موضوع
-- ورؤية إن ظهر استشهاد — وهذا استدلال غير مباشر على نصٍّ نظاميّ
-- تُبنى عليه سياسات شركات.
--
-- وثلاثة نواقص تُسدّ معًا لأنها سؤال واحد: «هل نجح الرفع فعلًا؟»
--
--   ١) لا يُعرف عدد المقاطع القابلة للبحث — فلا فرق ظاهر بين وثيقة
--      أنتجت ثلاث قطع وأخرى أنتجت ثلاثمئة.
--   ٢) لا معاينة للنصّ المخزَّن — فالثقة عمياء.
--   ٣) لا إعادة فهرسة — وفشلُ التضمين (حدّ معدّل المزوّد مثلًا) يوجب
--      الحذف وإعادة الرفع من الصفر.
--
-- والثالث هو سبب حفظ النصّ: الوثيقة الفاشلة **لا مقاطع لها**، فلا
-- يمكن إعادة بنائها منها. ولولا حفظ المصدر لبقيت إعادة المحاولة
-- مستحيلة في الحالة التي تحتاجها أكثر.
-- =====================================================================

alter table public.platform_reference_documents
  -- النصّ كما دخل الفهرسة: ملصوقًا كان أو مستخرَجًا من ملف.
  -- وهو ما يُعاد منه البناء وما يُعرض في المعاينة.
  add column if not exists source_text text,
  add column if not exists chunk_count int not null default 0;

comment on column public.platform_reference_documents.source_text is
  'النصّ الذي فُهرس فعلًا. يُحفظ ليُعاد منه البناء عند الفشل ولتُعرض '
  'المعاينة — فالوثيقة الفاشلة بلا مقاطع، ولا تُبنى من لا شيء.';

-- ---------- ملء العدد للصفوف القائمة ----------
-- لا تُترك على صفر فتبدو الوثائق المفهرسة كأنها خاوية.

update public.platform_reference_documents d
   set chunk_count = coalesce((
     select count(*) from public.platform_reference_chunks c
      where c.document_id = d.id
   ), 0)
 where d.chunk_count = 0;

-- =====================================================================
-- معاينة المقاطع — لمالكة المنصّة وحدها
--
-- تعرض ما فُهرس كما فُهرس، لا ما رُفع. والفرق جوهريّ: الاستخراج قد
-- يُسقط جدولًا أو يخلط عمودًا، والمعاينة هي ما يكشفه.
--
-- ومقصورة على المالك لا على «من يقرأ المكتبة»: كل الشركات تقرأ
-- المكتبة، ولا حاجة لأن يرى كلُّ مستخدمٍ بنيةَ التقطيع الداخلية.
-- =====================================================================

create or replace function public.preview_reference_chunks(
  p_document_id uuid,
  p_limit int default 20
)
returns table (
  chunk_index   int,
  content       text,
  token_count   int,
  has_embedding boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    return;
  end if;

  return query
  select c.chunk_index, c.content, c.token_count,
         -- المقطع بلا متجه لا يُرجَع في البحث أبدًا. وعرضُ هذا صراحةً
         -- يكشف الفهرسة نصف الناجحة، وهي أسوأ من الفاشلة المعلنة.
         (c.embedding is not null) as has_embedding
    from public.platform_reference_chunks c
   where c.document_id = p_document_id
   order by c.chunk_index
   limit greatest(1, least(coalesce(p_limit, 20), 100));
end;
$$;

revoke all on function public.preview_reference_chunks(uuid, int) from public;
grant execute on function public.preview_reference_chunks(uuid, int) to authenticated;
