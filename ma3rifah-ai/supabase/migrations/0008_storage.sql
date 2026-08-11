-- =====================================================================
-- 0008 — التخزين (Supabase Storage)
-- مسار الملف يبدأ دائمًا بمعرّف الشركة: <company_id>/<document_id>/<filename>
-- وهذا ما تعتمد عليه سياسات العزل أدناه.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,                       -- خاص: لا وصول مباشر بدون توقيع
  26214400,                    -- 25 ميجابايت
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/plain',
    'text/csv',
    'text/markdown'
  ]
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = excluded.public;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-assets',
  'company-assets',
  true,                        -- الشعارات والصور العامة
  2097152,                     -- 2 ميجابايت
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;

-- ---------- سياسات bucket المستندات ----------

drop policy if exists documents_storage_read on storage.objects;
create policy documents_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

drop policy if exists documents_storage_insert on storage.objects;
create policy documents_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.is_company_admin()
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

drop policy if exists documents_storage_update on storage.objects;
create policy documents_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and public.is_company_admin()
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

drop policy if exists documents_storage_delete on storage.objects;
create policy documents_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and public.is_company_admin()
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

-- ---------- سياسات bucket أصول الشركة ----------

drop policy if exists company_assets_read on storage.objects;
create policy company_assets_read on storage.objects
  for select to public
  using (bucket_id = 'company-assets');

drop policy if exists company_assets_write on storage.objects;
create policy company_assets_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'company-assets'
    and public.is_company_admin()
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );
