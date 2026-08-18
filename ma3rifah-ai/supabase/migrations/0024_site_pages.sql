-- =====================================================================
-- 0024 — صفحات يصنعها مالك المنصة
--
-- محرِّر المحتوى (0022) يغيّر نصوص صفحات موجودة، ولا يصنع صفحة جديدة.
-- وما يُطلب فعلًا بعد الإطلاق صفحةٌ لم تكن في الحسبان: «سياسة الاسترجاع»،
-- «للشركاء»، «حالة الخدمة»، صفحة حملة تسويقية. وانتظارُ مطوّر لكل واحدة
-- يجعل أسرع ما يتغيّر في العمل أبطأ ما في المنتج.
--
-- والمسار `/p/<الاسم>` بادئة مقصودة: تفصل ما يصنعه المالك عن مسارات
-- التطبيق فصلًا تامًّا. ولولاها لَاستطاع اسمُ صفحةٍ أن يحجب `/login` أو
-- `/documents` — وهو عطلٌ يصنعه من لا يعرف أنه يصنعه.
--
-- ولا يُخزَّن هنا إلا محتوى معروض للعامة.
-- =====================================================================

create table if not exists public.site_pages (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  description  text,
  body         text not null default '',
  status       text not null default 'DRAFT',
  show_in_nav  boolean not null default false,
  sort_order   integer not null default 0,
  updated_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint site_pages_status_check check (status in ('DRAFT', 'PUBLISHED')),

  -- لا مسافة ولا محرف يغيّر معنى المسار. والصيغة تقبل العربية عمدًا:
  -- من يكتب صفحة عربية يسمّيها بالعربية، وفرضُ اسم لاتيني عليه ضريبةٌ
  -- بلا مقابل. والمتصفحات تعرض العربية في المسار مقروءةً منذ سنين.
  constraint site_pages_slug_format check (slug ~ '^[^[:space:]/?#%&.]{2,60}$'),
  constraint site_pages_title_length check (length(title) between 1 and 200),
  constraint site_pages_description_length check (description is null or length(description) <= 500),
  constraint site_pages_body_length check (length(body) <= 200000)
);

create index if not exists site_pages_nav_idx
  on public.site_pages (sort_order, created_at)
  where status = 'PUBLISHED' and show_in_nav;

drop trigger if exists site_pages_set_updated_at on public.site_pages;
create trigger site_pages_set_updated_at
  before update on public.site_pages
  for each row execute function public.set_updated_at();

alter table public.site_pages enable row level security;

-- المنشور وحده يُقرأ، والمسوَّدة لا يراها أحد عبر هذه السياسة — ولا حتى
-- مالك المنصة. لأن اللوحة تقرأ بمفتاح الخدمة أصلًا، وتوسيعُ السياسة
-- لأجلها يفتح المسوَّدات على مسار لا يحتاجها.
drop policy if exists site_pages_read_published on public.site_pages;
create policy site_pages_read_published on public.site_pages
  for select to anon, authenticated
  using (status = 'PUBLISHED');

-- ولا سياسة كتابة لأي دور: الإنشاء والتعديل يمرّان بمفتاح الخدمة بعد
-- التحقق من أن الفاعل مالك المنصة. من يكتب صفحة عامة يكتب على واجهة
-- المنصة كلها، فلا تُترك هذه لسياسة تُقرأ بسرعة يومًا ما.
grant select on public.site_pages to anon, authenticated;
