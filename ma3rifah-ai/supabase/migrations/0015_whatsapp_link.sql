-- =====================================================================
-- 0015 — ربط واتساب بحساب الموظف
--
-- الخطر الجوهري في أي قناة خارجية: كيف نثبت أن هذا الرقم يخصّ هذا
-- الموظف في هذه الشركة؟ رقم الهاتف وحده لا يثبت شيئًا — يُنتحل،
-- ويُعاد تدويره بعد إلغاء الاشتراك، ويظهر مزوّرًا في بعض الشبكات.
-- ولو ربطناه بالثقة لصار العزل — أثمن ما في المنصة — يُخترق من باب
-- جانبي لا من الباب الذي حصّنّاه.
--
-- لذلك الربط يتطلب إثباتين معًا:
--   ١) جلسة صحيحة في المنصة  ← تُثبت هوية الموظف
--   ٢) رسالة من الرقم نفسه بالرمز ← تُثبت حيازة الهاتف
-- ولا يُقبل أي منهما وحده.
-- =====================================================================

create table if not exists public.whatsapp_links (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  -- بصيغة E.164 بلا رموز: 9665xxxxxxxx
  phone       text,
  -- رمز الربط لمرة واحدة، صالح دقائق معدودة
  link_code   text,
  code_expires_at timestamptz,
  verified_at timestamptz,
  last_used_at timestamptz,
  -- سقف يومي لكل رقم — يمنع استنزاف الرصيد عبر قناة مفتوحة
  messages_today int not null default 0,
  messages_day date,
  created_at  timestamptz not null default now(),
  -- رقم واحد لا يخدم حسابين: التباس الهوية أخطر من منع ربط مشروع
  constraint whatsapp_links_phone_unique unique (phone),
  constraint whatsapp_links_user_unique unique (user_id),
  constraint whatsapp_links_phone_digits check (phone is null or phone ~ '^[0-9]{8,20}$')
);

create index if not exists whatsapp_links_company_idx
  on public.whatsapp_links (company_id);

-- البحث بالرمز أثناء الربط
create index if not exists whatsapp_links_code_idx
  on public.whatsapp_links (link_code)
  where link_code is not null;

alter table public.whatsapp_links enable row level security;

-- يرى المستخدم ربطه هو، ويرى مدير الشركة روابط شركته (لإدارتها)
drop policy if exists whatsapp_links_select on public.whatsapp_links;
create policy whatsapp_links_select on public.whatsapp_links
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and (user_id = auth.uid() or public.is_company_admin())
  );

-- يحذف المستخدم ربطه، ويحذف مدير الشركة أي ربط في شركته
drop policy if exists whatsapp_links_delete on public.whatsapp_links;
create policy whatsapp_links_delete on public.whatsapp_links
  for delete to authenticated
  using (
    company_id = public.current_company_id()
    and (user_id = auth.uid() or public.is_company_admin())
  );

-- لا إدراج ولا تحديث من العميل إطلاقًا: الرمز يولَّد في دالة محصورة،
-- والتحقق يتم بمفتاح الخدمة داخل الويب هوك. لو فُتح الإدراج لأمكن
-- لمستخدم أن يربط رقمًا بنفسه بلا إثبات حيازة الهاتف.

grant select, delete on public.whatsapp_links to authenticated;

-- ---------- توليد رمز الربط ----------

create or replace function public.request_whatsapp_link_code()
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_code text;
  v_expires timestamptz;
begin
  select company_id into v_company
  from public.profiles
  where id = auth.uid() and status = 'ACTIVE';

  if v_company is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  -- رمز قصير قابل للكتابة يدويًا على الهاتف، ومن مجموعة بلا محارف
  -- ملتبسة (0/O و1/I) — الالتباس هنا يعني محاولة ربط فاشلة لا أكثر،
  -- لكنه يُحبط المستخدم في أول تجربة.
  v_code := 'MA-' || upper(
    translate(
      encode(gen_random_bytes(5), 'base32'),
      '01IO=', 'ABCDE'
    )
  );
  v_code := left(v_code, 11);
  v_expires := now() + interval '10 minutes';

  insert into public.whatsapp_links (company_id, user_id, link_code, code_expires_at)
  values (v_company, auth.uid(), v_code, v_expires)
  on conflict (user_id) do update
    set link_code = excluded.link_code,
        code_expires_at = excluded.code_expires_at,
        company_id = excluded.company_id,
        -- إعادة طلب الرمز تلغي الربط السابق: من يعيد الربط غالبًا غيّر
        -- رقمه، وإبقاء القديم صالحًا يترك رقمًا مهجورًا يصل إلى معرفة
        -- الشركة.
        phone = null,
        verified_at = null;

  return query select v_code, v_expires;
end;
$$;

revoke all on function public.request_whatsapp_link_code() from public, anon;
grant execute on function public.request_whatsapp_link_code() to authenticated;

-- =====================================================================
-- الاسترجاع لمستخدم بعينه — لقناة بلا جلسة متصفح
--
-- تشتق match_document_chunks الشركة والدور والقسم من auth.uid()، وهو
-- غير موجود في طلب يصل من واتساب. والحل ليس نسخ شرط الصلاحيات في
-- استعلام ثانٍ: تكرار ذلك الشرط هو بالضبط ما يجعل العزل ينكسر يومًا،
-- إذ يُعدَّل أحدهما ويُنسى الآخر.
--
-- لذلك يُستخرج المنطق إلى دالة داخلية واحدة تأخذ المستخدم صراحةً،
-- وتناديها النسخة العامة بـauth.uid()، والنسخة الخدمية بمعرّف يتحقق
-- منه الخادم من ربط هاتف موثّق. مصدر واحد للحقيقة.
-- =====================================================================

create or replace function public.match_chunks_for_user(
  p_user_id uuid,
  p_query_embedding vector(1024),
  p_match_count int default 8,
  p_min_similarity real default 0.30,
  p_category_ids uuid[] default null
)
returns table (
  chunk_id      uuid,
  document_id   uuid,
  document_name text,
  category_id   uuid,
  content       text,
  page_number   int,
  section_title text,
  similarity    real
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_role public.user_role;
  v_department uuid;
begin
  select company_id, role, department_id
    into v_company, v_role, v_department
  from public.profiles
  where id = p_user_id and status = 'ACTIVE';

  if v_company is null then
    raise exception 'unauthorized: no active company profile'
      using errcode = '42501';
  end if;

  p_match_count := least(greatest(coalesce(p_match_count, 8), 1), 20);

  return query
  select
    c.id,
    c.document_id,
    d.name,
    d.category_id,
    c.content,
    c.page_number,
    c.section_title,
    (1 - (c.embedding <=> p_query_embedding))::real as similarity
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where c.company_id = v_company
    and d.company_id = v_company
    and d.status = 'READY'
    and c.embedding is not null
    and (p_category_ids is null or d.category_id = any (p_category_ids))
    and (
      v_role = 'COMPANY_ADMIN'
      or d.visibility = 'COMPANY'
      or (d.visibility = 'DEPARTMENT'
          and v_department is not null
          and v_department = any (d.allowed_department_ids))
      or (d.visibility = 'ROLE' and v_role = any (d.allowed_roles))
    )
    and (1 - (c.embedding <=> p_query_embedding)) >= p_min_similarity
  order by c.embedding <=> p_query_embedding
  limit p_match_count;
end;
$$;

-- محجوبة عن المستخدمين: تأخذ معرّف مستخدم صراحةً، فلو نُفِّذت من عميل
-- لأمكن انتحال أي هوية. التنفيذ لمفتاح الخدمة وحده.
revoke all on function public.match_chunks_for_user(uuid, vector, int, real, uuid[])
  from public, anon, authenticated;

-- النسخة العامة تصير غلافًا رقيقًا فوق المنطق نفسه
create or replace function public.match_document_chunks(
  p_query_embedding vector(1024),
  p_match_count int default 8,
  p_min_similarity real default 0.30,
  p_category_ids uuid[] default null
)
returns table (
  chunk_id      uuid,
  document_id   uuid,
  document_name text,
  category_id   uuid,
  content       text,
  page_number   int,
  section_title text,
  similarity    real
)
language sql
stable
security definer
set search_path = public
as $$
  select * from public.match_chunks_for_user(
    auth.uid(), p_query_embedding, p_match_count, p_min_similarity, p_category_ids
  );
$$;

revoke all on function public.match_document_chunks(vector, int, real, uuid[]) from public, anon;
grant execute on function public.match_document_chunks(vector, int, real, uuid[]) to authenticated;
