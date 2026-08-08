import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { config } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

config({ path: '.env.local' });
config({ path: '.env' });

/**
 * اختبار العزل بين المستأجرين.
 *
 * هذا أهم اختبار في المشروع: يتحقق من أن شركة «أ» لا تستطيع الوصول
 * إلى أي بيان يخص شركة «ب» — لا عبر استعلام مباشر، ولا عبر البحث
 * الدلالي، ولا عبر تمرير معرّف صريح.
 *
 * يتطلب اتصالًا بقاعدة بيانات Supabase حقيقية طُبِّقت عليها ملفات
 * migrations. يتخطّى نفسه تلقائيًا إن لم تتوفر متغيرات البيئة، حتى لا
 * يفشل البناء على بيئة بلا قاعدة بيانات.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CAN_RUN = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_KEY);
const suite = CAN_RUN ? describe : describe.skip;

const RUN_ID = Math.random().toString(36).slice(2, 8);
const PASSWORD = 'IsolationTest!2026';

interface Tenant {
  companyId: string;
  userId: string;
  email: string;
  departmentId: string;
  documentId: string;
  conversationId: string;
  client: SupabaseClient<Database>;
}

let admin: SupabaseClient<Database>;
const tenants: Record<'a' | 'b', Tenant> = {} as Record<'a' | 'b', Tenant>;

async function createTenant(key: 'a' | 'b'): Promise<Tenant> {
  const email = `isolation-${key}-${RUN_ID}@test.invalid`;

  const { data: company, error: companyError } = await admin
    .from('companies')
    .insert({ name: `شركة اختبار ${key.toUpperCase()} ${RUN_ID}`, slug: `iso-${key}-${RUN_ID}` })
    .select('id')
    .single();
  if (companyError || !company) throw new Error(`تعذّر إنشاء الشركة: ${companyError?.message}`);

  const { data: department } = await admin
    .from('departments')
    .insert({ company_id: company.id, name: 'قسم الاختبار' })
    .select('id')
    .single();
  if (!department) throw new Error('تعذّر إنشاء القسم');

  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (userError || !created.user) throw new Error(`تعذّر إنشاء المستخدم: ${userError?.message}`);

  await admin
    .from('profiles')
    .update({
      company_id: company.id,
      department_id: department.id,
      full_name: `مستخدم ${key}`,
      email,
      role: 'COMPANY_ADMIN',
      status: 'ACTIVE',
    })
    .eq('id', created.user.id);

  const { data: document } = await admin
    .from('documents')
    .insert({
      company_id: company.id,
      name: `مستند سري للشركة ${key.toUpperCase()}`,
      file_type: 'text/plain',
      file_size_bytes: 100,
      status: 'READY',
      visibility: 'COMPANY',
      uploaded_by: created.user.id,
    })
    .select('id')
    .single();
  if (!document) throw new Error('تعذّر إنشاء المستند');

  // مقطع بمتجه ثابت — يجعل البحث الدلالي حتميًا في الاختبار
  const embedding = `[${Array.from({ length: 1024 }, (_, i) => (i === 0 ? 1 : 0)).join(',')}]`;
  await admin.from('document_chunks').insert({
    company_id: company.id,
    document_id: document.id,
    chunk_index: 0,
    content: `محتوى سري خاص بالشركة ${key.toUpperCase()} — لا يجوز أن تراه شركة أخرى.`,
    embedding,
  });

  const { data: conversation } = await admin
    .from('conversations')
    .insert({ company_id: company.id, user_id: created.user.id, title: `محادثة ${key}` })
    .select('id')
    .single();
  if (!conversation) throw new Error('تعذّر إنشاء المحادثة');

  await admin.from('messages').insert({
    company_id: company.id,
    conversation_id: conversation.id,
    user_id: created.user.id,
    role: 'USER',
    content: `سؤال خاص بالشركة ${key.toUpperCase()}`,
  });

  await admin.from('knowledge_gaps').insert({
    company_id: company.id,
    question: `فجوة معرفة خاصة بالشركة ${key.toUpperCase()}`,
    normalized_question: `gap ${key} ${RUN_ID}`,
  });

  // عميل بجلسة المستخدم — يمر عبر RLS تمامًا كما في التطبيق
  const client = createClient<Database>(SUPABASE_URL!, ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw new Error(`تعذّر تسجيل الدخول: ${signInError.message}`);

  return {
    companyId: company.id,
    userId: created.user.id,
    email,
    departmentId: department.id,
    documentId: document.id,
    conversationId: conversation.id,
    client,
  };
}

suite('عزل المستأجرين', () => {
  beforeAll(async () => {
    admin = createClient<Database>(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    tenants.a = await createTenant('a');
    tenants.b = await createTenant('b');
  });

  afterAll(async () => {
    if (!admin) return;
    for (const tenant of Object.values(tenants)) {
      if (!tenant) continue;
      await admin.auth.admin.deleteUser(tenant.userId).catch(() => undefined);
      await admin.from('companies').delete().eq('id', tenant.companyId);
    }
  });

  it('شركة أ لا ترى شركة ب في جدول الشركات', async () => {
    const { data } = await tenants.a.client.from('companies').select('id, name');

    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe(tenants.a.companyId);
  });

  it('شركة أ لا ترى مستندات شركة ب', async () => {
    const { data } = await tenants.a.client.from('documents').select('id, company_id');

    expect(data?.every((row) => row.company_id === tenants.a.companyId)).toBe(true);
    expect(data?.some((row) => row.id === tenants.b.documentId)).toBe(false);
  });

  it('تمرير معرّف مستند شركة ب صراحةً لا يُرجع شيئًا', async () => {
    const { data } = await tenants.a.client
      .from('documents')
      .select('*')
      .eq('id', tenants.b.documentId);

    expect(data).toEqual([]);
  });

  it('شركة أ لا تقرأ مقاطع مستندات شركة ب', async () => {
    const { data } = await tenants.a.client
      .from('document_chunks')
      .select('id, company_id, content');

    expect(data?.every((row) => row.company_id === tenants.a.companyId)).toBe(true);
    expect(data?.some((row) => row.content.includes('الشركة B'))).toBe(false);
  });

  it('البحث الدلالي لا يعبر حدود الشركة', async () => {
    const embedding = `[${Array.from({ length: 1024 }, (_, i) => (i === 0 ? 1 : 0)).join(',')}]`;

    const { data, error } = await tenants.a.client.rpc('match_document_chunks', {
      p_query_embedding: embedding,
      p_match_count: 20,
      p_min_similarity: 0,
    });

    expect(error).toBeNull();
    // المتجه مطابق تمامًا لمقاطع الشركتين، ومع ذلك تعود مقاطع شركة أ فقط
    expect(data?.length).toBeGreaterThan(0);
    expect(data?.every((row) => row.document_id === tenants.a.documentId)).toBe(true);
    expect(data?.some((row) => row.content.includes('الشركة B'))).toBe(false);
  });

  it('شركة أ لا ترى محادثات ورسائل شركة ب', async () => {
    const { data: conversations } = await tenants.a.client
      .from('conversations')
      .select('id, company_id');
    expect(conversations?.every((row) => row.company_id === tenants.a.companyId)).toBe(true);

    const { data: messages } = await tenants.a.client.from('messages').select('id, company_id');
    expect(messages?.every((row) => row.company_id === tenants.a.companyId)).toBe(true);
  });

  it('شركة أ لا ترى فجوات معرفة شركة ب', async () => {
    const { data } = await tenants.a.client
      .from('knowledge_gaps')
      .select('id, company_id, question');

    expect(data?.every((row) => row.company_id === tenants.a.companyId)).toBe(true);
    expect(data?.some((row) => row.question.includes('الشركة B'))).toBe(false);
  });

  it('شركة أ لا ترى مستخدمي شركة ب', async () => {
    const { data } = await tenants.a.client.from('profiles').select('id, company_id, email');

    expect(data?.every((row) => row.company_id === tenants.a.companyId)).toBe(true);
    expect(data?.some((row) => row.email === tenants.b.email)).toBe(false);
  });

  it('شركة أ لا ترى أقسام شركة ب', async () => {
    const { data } = await tenants.a.client.from('departments').select('id, company_id');

    expect(data?.every((row) => row.company_id === tenants.a.companyId)).toBe(true);
    expect(data?.some((row) => row.id === tenants.b.departmentId)).toBe(false);
  });

  it('شركة أ لا تستطيع تعديل مستند شركة ب', async () => {
    const { data } = await tenants.a.client
      .from('documents')
      .update({ name: 'اسم مخترق' })
      .eq('id', tenants.b.documentId)
      .select('id');

    expect(data ?? []).toEqual([]);

    // التحقق من الجهة المقابلة: الاسم لم يتغيّر فعليًا
    const { data: original } = await admin
      .from('documents')
      .select('name')
      .eq('id', tenants.b.documentId)
      .single();

    expect(original?.name).not.toBe('اسم مخترق');
  });

  it('شركة أ لا تستطيع حذف مستند شركة ب', async () => {
    await tenants.a.client.from('documents').delete().eq('id', tenants.b.documentId);

    const { data: stillThere } = await admin
      .from('documents')
      .select('id')
      .eq('id', tenants.b.documentId)
      .maybeSingle();

    expect(stillThere).not.toBeNull();
  });

  it('شركة أ لا تستطيع إدراج صف باسم شركة ب', async () => {
    const { error } = await tenants.a.client.from('departments').insert({
      company_id: tenants.b.companyId,
      name: 'قسم مزروع',
    });

    expect(error).not.toBeNull();
  });

  it('شركة أ لا تستطيع نقل مستخدم إلى شركة ب', async () => {
    await tenants.a.client
      .from('profiles')
      .update({ company_id: tenants.b.companyId })
      .eq('id', tenants.a.userId);

    const { data: profile } = await admin
      .from('profiles')
      .select('company_id')
      .eq('id', tenants.a.userId)
      .single();

    expect(profile?.company_id).toBe(tenants.a.companyId);
  });

  it('المستخدم لا يستطيع ترقية نفسه إلى مدير منصة', async () => {
    await tenants.a.client
      .from('profiles')
      .update({ role: 'SUPER_ADMIN' })
      .eq('id', tenants.a.userId);

    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', tenants.a.userId)
      .single();

    expect(profile?.role).toBe('COMPANY_ADMIN');
  });

  it('حصة الأسئلة تُحسب لشركة المستخدم نفسه', async () => {
    const { data, error } = await tenants.a.client.rpc('check_question_quota');

    expect(error).toBeNull();
    expect(data?.[0]).toBeDefined();
  });

  it('إحصاءات لوحة التحكم لا تشمل بيانات شركة أخرى', async () => {
    const { data } = await tenants.a.client.rpc('company_dashboard_stats');
    const stats = data?.[0];

    expect(stats).toBeDefined();
    // شركة أ فيها مستند واحد ومستخدم واحد فقط
    expect(Number(stats?.documents_count)).toBe(1);
    expect(Number(stats?.users_count)).toBe(1);
  });
});

if (!CAN_RUN) {
  describe('عزل المستأجرين', () => {
    it('تخطّي — متغيرات Supabase غير مضبوطة', () => {
      expect(true).toBe(true);
    });
  });
}
