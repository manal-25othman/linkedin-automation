-- =====================================================================
-- 0037 — استبيان الرأي داخل المنصة
--
-- كانت الدعوة «شاركنا رأيك» تفتح رابطًا خارجيًا. الآن الاستبيان صفحة
-- داخل المنصة: يملؤه المستخدم مرة (ويستطيع تعديله)، ويقرؤه مالك المنصة
-- من لوحته. لا يُطلب فيه أي بيان شخصي: الاسم والشركة يأتيان من الجلسة.
-- =====================================================================

create table if not exists public.feedback_surveys (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  role             public.user_role not null,
  -- الرضا العام من ١ إلى ٥
  overall_rating   smallint not null check (overall_rating between 1 and 5),
  -- هل وجد إجابات لأسئلته
  found_answers    text not null check (found_answers in ('MOSTLY', 'SOMETIMES', 'RARELY')),
  -- هل ينصح بها زميلًا من ١ إلى ٥
  recommend_rating smallint not null check (recommend_rating between 1 and 5),
  most_useful      text,
  missing          text,
  -- يوافق أن يتواصل معه فريق المنصة
  allow_contact    boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- إجابة واحدة لكل مستخدم — التعديل بدل التكرار
  constraint feedback_surveys_one_per_user unique (user_id)
);

create index if not exists feedback_surveys_company_idx
  on public.feedback_surveys (company_id, created_at desc);

drop trigger if exists feedback_surveys_set_updated_at on public.feedback_surveys;
create trigger feedback_surveys_set_updated_at
  before update on public.feedback_surveys
  for each row execute function public.set_updated_at();

alter table public.feedback_surveys enable row level security;

-- يقرأ المستخدم إجابته هو فقط؛ ومالك المنصة يقرأ الكل من لوحته
drop policy if exists feedback_surveys_select on public.feedback_surveys;
create policy feedback_surveys_select on public.feedback_surveys
  for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin());

-- يُدرج المستخدم باسمه وشركته من الجلسة لا من النموذج
drop policy if exists feedback_surveys_insert on public.feedback_surveys;
create policy feedback_surveys_insert on public.feedback_surveys
  for insert to authenticated
  with check (user_id = auth.uid() and company_id = public.current_company_id());

-- يعدّل إجابته هو فقط، ولا ينقلها إلى مستخدم أو شركة أخرى
drop policy if exists feedback_surveys_update on public.feedback_surveys;
create policy feedback_surveys_update on public.feedback_surveys
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and company_id = public.current_company_id());

grant select, insert, update on public.feedback_surveys to authenticated;
