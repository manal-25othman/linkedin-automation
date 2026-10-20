-- =====================================================================
-- 0044 — رفع ملفات إلى المكتبة المرجعية
--
-- المفارقة التي تُصلَح هنا: خطّ معالجة المستندات في هذا المنتج يفكّ
-- PDF العربي المشوّه، ويقرأ الممسوح ضوئيًا، ويقيس جودة الاستخراج
-- ويرفض الملف الفاسد. **والمكتبة المرجعية وحدها لا تستعمل منه شيئًا**:
-- تطلب لصق النصّ يدويًا.
--
-- أي أن أهمّ نصّ في المنصّة — النظام الذي تستند إليه سياسات الشركات —
-- هو الوحيد الذي يدخل من أضعف باب.
--
-- ودلوٌ منفصل لا بادئة محجوزة داخل دلو الشركات: ملفات المنصّة لا
-- تُخلَط بملفات العملاء. والفصل البنيوي هنا هو نفسه الذي دعا إلى فصل
-- جداول المكتبة في `0039` — سياسةٌ واحدة تتغيّر يومًا فتكشف ما لا يُقصد.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reference-library',
  'reference-library',
  false,                        -- خاص: لا وصول مباشر
  52428800,                     -- ٥٠ ميغابايت: الأنظمة ملفات كبيرة
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/markdown'
  ]
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public             = excluded.public;

/*
 * لا سياسة لأي دور مصادَق — وهذا مقصود.
 *
 * الرفع والقراءة يجريان بمفتاح الخدمة من الخادم وحده: مالكة المنصّة
 * تطلب رابط رفع موقّعًا من إجراء محروس بـ`requireSuperAdmin`، فلا
 * حاجة لفتح الدلو لأي مستخدم. وكل سياسة لا تلزم بابٌ يُنسى مفتوحًا.
 */

-- ---------- أثر الملف على الوثيقة المرجعية ----------

alter table public.platform_reference_documents
  add column if not exists storage_path text,
  add column if not exists checksum text,
  add column if not exists page_count int,
  add column if not exists ocr_pages int not null default 0;

comment on column public.platform_reference_documents.storage_path is
  'مسار الملف الأصلي إن رُفع ملفًا. فارغ إن لُصق النصّ مباشرةً.';
comment on column public.platform_reference_documents.checksum is
  'بصمة SHA-256 للنصّ المستخرَج. تُستعمل لاحقًا لكشف تغيّر النظام في '
  'مصدره بمقارنة بصمة لا بتخزين نسختين.';

-- ---------- تاريخ آخر تحقق من المصدر ----------
--
-- لا يفعل شيئًا اليوم: لا جلب آليًا ولا مراقبة. ووجوده الآن يجعل
-- المراقبة لاحقًا **إضافةً لا ترحيلًا يمسّ بيانات حيّة**.
alter table public.platform_reference_documents
  add column if not exists source_checked_at timestamptz;
