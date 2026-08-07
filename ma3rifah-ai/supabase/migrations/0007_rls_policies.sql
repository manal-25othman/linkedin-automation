-- =====================================================================
-- 0007 — Row Level Security
-- المبدأ: منع افتراضي. كل صف لا ينتمي إلى شركة المستخدم غير مرئي.
-- مفتاح service_role يتجاوز RLS، لذا لا يُستخدم إلا على الخادم
-- وبعد تحقق صريح من الصلاحيات في طبقة التطبيق.
-- =====================================================================

alter table public.companies            enable row level security;
alter table public.departments          enable row level security;
alter table public.profiles             enable row level security;
alter table public.knowledge_categories enable row level security;
alter table public.documents            enable row level security;
alter table public.document_chunks      enable row level security;
alter table public.conversations        enable row level security;
alter table public.messages             enable row level security;
alter table public.message_sources      enable row level security;
alter table public.knowledge_gaps       enable row level security;
alter table public.analytics_events     enable row level security;
alter table public.plans                enable row level security;
alter table public.subscriptions        enable row level security;
alter table public.usage_records        enable row level security;
alter table public.ai_usage_logs        enable row level security;
alter table public.audit_logs           enable row level security;

-- منع أي وصول مجهول افتراضيًا
alter table public.companies            force row level security;
alter table public.documents            force row level security;
alter table public.document_chunks      force row level security;

-- =====================================================================
-- companies
-- =====================================================================

drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies
  for select to authenticated
  using (public.is_super_admin() or id = public.current_company_id());

drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies
  for update to authenticated
  using (public.is_super_admin() or (id = public.current_company_id() and public.is_company_admin()))
  with check (public.is_super_admin() or (id = public.current_company_id() and public.is_company_admin()));

drop policy if exists companies_insert on public.companies;
create policy companies_insert on public.companies
  for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists companies_delete on public.companies;
create policy companies_delete on public.companies
  for delete to authenticated
  using (public.is_super_admin());

-- =====================================================================
-- departments
-- =====================================================================

drop policy if exists departments_select on public.departments;
create policy departments_select on public.departments
  for select to authenticated
  using (public.belongs_to_current_company(company_id));

drop policy if exists departments_write on public.departments;
create policy departments_write on public.departments
  for all to authenticated
  using (public.belongs_to_current_company(company_id) and public.is_company_admin())
  with check (public.belongs_to_current_company(company_id) and public.is_company_admin());

-- =====================================================================
-- profiles
-- =====================================================================

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_select_company on public.profiles;
create policy profiles_select_company on public.profiles
  for select to authenticated
  using (public.belongs_to_current_company(company_id));

-- المستخدم يعدّل بياناته الشخصية فقط، ولا يستطيع ترقية نفسه.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and company_id is not distinct from (select p.company_id from public.profiles p where p.id = auth.uid())
    and status = (select p.status from public.profiles p where p.id = auth.uid())
  );

drop policy if exists profiles_admin_manage on public.profiles;
create policy profiles_admin_manage on public.profiles
  for update to authenticated
  using (public.belongs_to_current_company(company_id) and public.is_company_admin())
  with check (
    public.belongs_to_current_company(company_id)
    and public.is_company_admin()
    -- مدير الشركة لا يستطيع ترقية أحد إلى مدير منصة
    and (role <> 'SUPER_ADMIN' or public.is_super_admin())
  );

drop policy if exists profiles_admin_insert on public.profiles;
create policy profiles_admin_insert on public.profiles
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (public.belongs_to_current_company(company_id) and public.is_company_admin() and role <> 'SUPER_ADMIN')
  );

drop policy if exists profiles_admin_delete on public.profiles;
create policy profiles_admin_delete on public.profiles
  for delete to authenticated
  using (public.is_super_admin());

-- =====================================================================
-- knowledge_categories
-- =====================================================================

drop policy if exists knowledge_categories_select on public.knowledge_categories;
create policy knowledge_categories_select on public.knowledge_categories
  for select to authenticated
  using (public.belongs_to_current_company(company_id));

drop policy if exists knowledge_categories_write on public.knowledge_categories;
create policy knowledge_categories_write on public.knowledge_categories
  for all to authenticated
  using (public.belongs_to_current_company(company_id) and public.is_company_admin())
  with check (public.belongs_to_current_company(company_id) and public.is_company_admin());

-- =====================================================================
-- documents
-- =====================================================================

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
  for select to authenticated
  using (
    public.can_read_document(company_id, visibility, allowed_department_ids, allowed_roles)
  );

drop policy if exists documents_write on public.documents;
create policy documents_write on public.documents
  for all to authenticated
  using (public.belongs_to_current_company(company_id) and public.is_company_admin())
  with check (public.belongs_to_current_company(company_id) and public.is_company_admin());

-- =====================================================================
-- document_chunks
-- المقاطع تحمل نص المستند، لذا ترث صلاحياته بالكامل.
-- =====================================================================

drop policy if exists document_chunks_select on public.document_chunks;
create policy document_chunks_select on public.document_chunks
  for select to authenticated
  using (
    exists (
      select 1 from public.documents d
      where d.id = document_chunks.document_id
        and public.can_read_document(d.company_id, d.visibility, d.allowed_department_ids, d.allowed_roles)
    )
  );

drop policy if exists document_chunks_write on public.document_chunks;
create policy document_chunks_write on public.document_chunks
  for all to authenticated
  using (public.belongs_to_current_company(company_id) and public.is_company_admin())
  with check (public.belongs_to_current_company(company_id) and public.is_company_admin());

-- =====================================================================
-- conversations — خاصة بصاحبها
-- =====================================================================

drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select to authenticated
  using (user_id = auth.uid() and public.belongs_to_current_company(company_id));

drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert on public.conversations
  for insert to authenticated
  with check (user_id = auth.uid() and company_id = public.current_company_id());

drop policy if exists conversations_update on public.conversations;
create policy conversations_update on public.conversations
  for update to authenticated
  using (user_id = auth.uid() and public.belongs_to_current_company(company_id))
  with check (user_id = auth.uid() and public.belongs_to_current_company(company_id));

drop policy if exists conversations_delete on public.conversations;
create policy conversations_delete on public.conversations
  for delete to authenticated
  using (user_id = auth.uid() and public.belongs_to_current_company(company_id));

-- =====================================================================
-- messages
-- =====================================================================

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.user_id = auth.uid()
        and public.belongs_to_current_company(c.company_id)
    )
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.user_id = auth.uid()
    )
  );

-- التقييم فقط (👍/👎) — لا يجوز تعديل نص الرسالة بعد إنشائها
drop policy if exists messages_update_feedback on public.messages;
create policy messages_update_feedback on public.messages
  for update to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.user_id = auth.uid()
    )
  );

-- =====================================================================
-- message_sources
-- =====================================================================

drop policy if exists message_sources_select on public.message_sources;
create policy message_sources_select on public.message_sources
  for select to authenticated
  using (
    exists (
      select 1
      from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_sources.message_id
        and c.user_id = auth.uid()
        and public.belongs_to_current_company(c.company_id)
    )
  );

drop policy if exists message_sources_insert on public.message_sources;
create policy message_sources_insert on public.message_sources
  for insert to authenticated
  with check (company_id = public.current_company_id());

-- =====================================================================
-- knowledge_gaps — يقرأها المديرون فقط
-- =====================================================================

drop policy if exists knowledge_gaps_select on public.knowledge_gaps;
create policy knowledge_gaps_select on public.knowledge_gaps
  for select to authenticated
  using (public.belongs_to_current_company(company_id) and public.is_manager_or_above());

drop policy if exists knowledge_gaps_write on public.knowledge_gaps;
create policy knowledge_gaps_write on public.knowledge_gaps
  for all to authenticated
  using (public.belongs_to_current_company(company_id) and public.is_company_admin())
  with check (public.belongs_to_current_company(company_id) and public.is_company_admin());

-- =====================================================================
-- analytics_events
-- =====================================================================

drop policy if exists analytics_events_select on public.analytics_events;
create policy analytics_events_select on public.analytics_events
  for select to authenticated
  using (public.belongs_to_current_company(company_id) and public.is_manager_or_above());

drop policy if exists analytics_events_insert on public.analytics_events;
create policy analytics_events_insert on public.analytics_events
  for insert to authenticated
  with check (company_id = public.current_company_id());

-- =====================================================================
-- plans — الخطط العامة مقروءة للجميع
-- =====================================================================

drop policy if exists plans_select on public.plans;
create policy plans_select on public.plans
  for select to authenticated, anon
  using (is_public or public.is_super_admin());

drop policy if exists plans_write on public.plans;
create policy plans_write on public.plans
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- =====================================================================
-- subscriptions / usage_records / ai_usage_logs
-- =====================================================================

drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (public.belongs_to_current_company(company_id) and public.is_company_admin());

drop policy if exists subscriptions_write on public.subscriptions;
create policy subscriptions_write on public.subscriptions
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists usage_records_select on public.usage_records;
create policy usage_records_select on public.usage_records
  for select to authenticated
  using (public.belongs_to_current_company(company_id) and public.is_company_admin());

drop policy if exists ai_usage_logs_select on public.ai_usage_logs;
create policy ai_usage_logs_select on public.ai_usage_logs
  for select to authenticated
  using (public.belongs_to_current_company(company_id) and public.is_company_admin());

-- =====================================================================
-- audit_logs — قراءة فقط، والكتابة عبر الخادم
-- =====================================================================

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (public.belongs_to_current_company(company_id) and public.is_company_admin());

-- =====================================================================
-- صلاحيات تنفيذ الدوال
-- =====================================================================

revoke all on function public.match_document_chunks(vector, int, real, uuid[]) from public;
grant execute on function public.match_document_chunks(vector, int, real, uuid[]) to authenticated;

revoke all on function public.record_knowledge_gap(text) from public;
grant execute on function public.record_knowledge_gap(text) to authenticated;

revoke all on function public.check_question_quota() from public;
grant execute on function public.check_question_quota() to authenticated;

revoke all on function public.record_usage(uuid, int, bigint, bigint, numeric) from public;
grant execute on function public.record_usage(uuid, int, bigint, bigint, numeric) to service_role;
