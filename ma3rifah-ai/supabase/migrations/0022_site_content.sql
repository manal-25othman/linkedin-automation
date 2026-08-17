-- =====================================================================
-- 0022 — محتوى الموقع القابل للتحرير
--
-- نصوص الموقع التعريفي كانت مكتوبة داخل الشيفرة، فتغيير كلمة يحتاج
-- مطوّرًا ونشرًا. وصاحبة المنتج أدرى بصياغة عرضها من أي أحد، فبقاء
-- النصّ حبيس الشيفرة يجعل أهمّ ما في الموقع أبطأ ما فيه تغييرًا.
--
-- والتصميم هنا **تجاوزات لا مصدر**: يبقى النصّ الأصلي في الشيفرة قيمةً
-- افتراضية، ويحمل هذا الجدول ما غُيِّر منه فقط. ولذلك ثلاث فوائد:
--
--   • جدول فارغ = الموقع كما هو. فلا يتوقف على ترحيل ولا على بيانات.
--   • حذف صفّ = عودة إلى النصّ الأصلي، بلا حاجة إلى تذكّره.
--   • مفتاح لم يعد مستعملًا في الشيفرة يُهمَل بلا ضرر.
--
-- ولا يُخزَّن هنا إلا نصّ يُعرض للعامة — لا أسرار ولا بيانات شركات.
-- =====================================================================

create table if not exists public.site_content (
  -- مفتاح ثابت يشير إليه الكود، مثل: home.hero.title
  key        text primary key,
  value      text not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint site_content_key_format check (key ~ '^[a-z0-9]+(\.[a-z0-9_]+)+$'),
  constraint site_content_value_length check (length(value) <= 5000)
);

drop trigger if exists site_content_set_updated_at on public.site_content;
create trigger site_content_set_updated_at
  before update on public.site_content
  for each row execute function public.set_updated_at();

alter table public.site_content enable row level security;

-- يقرؤه الجميع بلا استثناء: هذا نصّ صفحة عامة، والزائر غير المسجّل هو
-- قارئه الأول. ولا معنى لحجب ما يُعرض على الصفحة نفسها.
drop policy if exists site_content_read on public.site_content;
create policy site_content_read on public.site_content
  for select to anon, authenticated
  using (true);

-- ولا سياسة كتابة لأي دور: التحرير يمرّ بمفتاح الخدمة بعد التحقق من أن
-- المُحرِّر مالك المنصة. محتوى الصفحة الرئيسية سطحُ عرضٍ عام، ومن يكتب
-- فيه يكتب على واجهة المنصة كلها.
grant select on public.site_content to anon, authenticated;
