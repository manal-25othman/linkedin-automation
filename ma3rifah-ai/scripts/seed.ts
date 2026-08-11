/**
 * سكربت البيانات التجريبية — DEMO DATA
 *
 * ينشئ شركة «معرفة للتقنية» ببيانات وهمية بالكامل لغرض العرض:
 * أقسام، تصنيفات، مستخدمين، مستندات مفهرسة فعليًا، فجوات معرفة،
 * وسجلات استهلاك.
 *
 * التشغيل:  npm run db:seed
 * إعادة البناء من الصفر:  npm run db:seed -- --reset
 *
 * ملاحظات:
 *  - يعمل بمفتاح الخدمة، فلا يُشغَّل إلا محليًا أو من بيئة موثوقة.
 *  - المستندات تُفهرس عبر خط المعالجة الحقيقي (استخراج ← تقطيع ← تضمين)،
 *    فما تراه في العرض هو سلوك المنتج الفعلي لا محاكاة له.
 *  - المحادثات التجريبية تُولَّد باستدعاء حقيقي لـ Claude إن توفّر المفتاح.
 *    بدونه يتخطّى السكربت هذه الخطوة بدل اختلاق إجابات.
 */

import { config } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database, UserRole } from '../src/types/database';
import {
  DEMO_COMPANY_NAME,
  DEMO_COMPANY_SLUG,
  DEMO_DOCUMENTS,
  DEMO_QUESTIONS,
  DEMO_KNOWLEDGE_GAPS,
  DEMO_USERS,
} from './demo-content';
import { DEFAULT_DEPARTMENTS, DEFAULT_CATEGORIES } from '../src/lib/config/defaults';

config({ path: '.env.local' });
config({ path: '.env' });

const RESET = process.argv.includes('--reset');

type Admin = SupabaseClient<Database>;

/* ------------------------------------------------------------------ أدوات */

const log = {
  step: (message: string) => console.log(`\n▸ ${message}`),
  info: (message: string) => console.log(`  ${message}`),
  ok: (message: string) => console.log(`  ✓ ${message}`),
  warn: (message: string) => console.warn(`  ! ${message}`),
  fail: (message: string) => console.error(`  ✗ ${message}`),
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    log.fail(`متغير البيئة ${name} غير مضبوط.`);
    process.exit(1);
  }
  return value;
}

/* ------------------------------------------------------------- الشركة */

async function resetDemoCompany(admin: Admin): Promise<void> {
  log.step('حذف بيانات الشركة التجريبية السابقة');

  const { data: company } = await admin
    .from('companies')
    .select('id')
    .eq('slug', DEMO_COMPANY_SLUG)
    .maybeSingle();

  if (!company) {
    log.info('لا توجد شركة تجريبية سابقة.');
    return;
  }

  // حذف حسابات المصادقة أولًا — حذف الشركة يزيل ملفاتهم بالتتالي
  for (const user of DEMO_USERS) {
    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('email', user.email)
      .maybeSingle();
    if (profile) {
      await admin.auth.admin.deleteUser(profile.id);
    }
  }

  // ملفات التخزين
  const { data: files } = await admin.storage.from('documents').list(company.id, { limit: 1000 });
  for (const folder of files ?? []) {
    const { data: inner } = await admin.storage
      .from('documents')
      .list(`${company.id}/${folder.name}`, { limit: 100 });
    const paths = (inner ?? []).map((file) => `${company.id}/${folder.name}/${file.name}`);
    if (paths.length > 0) await admin.storage.from('documents').remove(paths);
  }

  await admin.from('companies').delete().eq('id', company.id);
  log.ok('تم الحذف.');
}

async function ensureCompany(admin: Admin): Promise<string> {
  log.step('إنشاء الشركة التجريبية');

  const { data: existing } = await admin
    .from('companies')
    .select('id')
    .eq('slug', DEMO_COMPANY_SLUG)
    .maybeSingle();

  if (existing) {
    log.info(`الشركة موجودة (${existing.id}).`);
    return existing.id;
  }

  const { data, error } = await admin
    .from('companies')
    .insert({
      name: DEMO_COMPANY_NAME,
      slug: DEMO_COMPANY_SLUG,
      industry: 'تقنية المعلومات',
      is_demo: true,
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(`تعذّر إنشاء الشركة: ${error?.message}`);

  log.ok(`${DEMO_COMPANY_NAME} — ${data.id}`);
  return data.id;
}

async function ensureSubscription(admin: Admin, companyId: string): Promise<void> {
  log.step('تفعيل الاشتراك');

  const { data: existing } = await admin
    .from('subscriptions')
    .select('id')
    .eq('company_id', companyId)
    .maybeSingle();

  if (existing) {
    log.info('الاشتراك موجود.');
    return;
  }

  const { data: plan } = await admin
    .from('plans')
    .select('id')
    .eq('code', 'BUSINESS')
    .maybeSingle();

  if (!plan) {
    log.warn('خطة BUSINESS غير موجودة — شغّل ملفات migrations أولًا.');
    return;
  }

  const periodEnd = new Date();
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);

  await admin.from('subscriptions').insert({
    company_id: companyId,
    plan_id: plan.id,
    status: 'ACTIVE',
    current_period_end: periodEnd.toISOString(),
  });

  log.ok('اشتراك Business نشط.');
}

/* ------------------------------------------------- الأقسام والتصنيفات */

async function ensureDepartments(admin: Admin, companyId: string): Promise<Map<string, string>> {
  log.step('إنشاء الأقسام');

  await admin.from('departments').upsert(
    DEFAULT_DEPARTMENTS.map((department) => ({
      company_id: companyId,
      name: department.name,
      code: department.code,
      description: department.description,
    })),
    { onConflict: 'company_id,name', ignoreDuplicates: true },
  );

  const { data } = await admin
    .from('departments')
    .select('id, name')
    .eq('company_id', companyId);

  const map = new Map((data ?? []).map((row) => [row.name, row.id]));
  log.ok(`${map.size} قسم.`);
  return map;
}

async function ensureCategories(admin: Admin, companyId: string): Promise<Map<string, string>> {
  log.step('إنشاء تصنيفات المعرفة');

  await admin.from('knowledge_categories').upsert(
    DEFAULT_CATEGORIES.map((category) => ({
      company_id: companyId,
      name: category.name,
      description: category.description,
      color: category.color,
      sort_order: category.sort_order,
    })),
    { onConflict: 'company_id,name', ignoreDuplicates: true },
  );

  const { data } = await admin
    .from('knowledge_categories')
    .select('id, name')
    .eq('company_id', companyId);

  const map = new Map((data ?? []).map((row) => [row.name, row.id]));
  log.ok(`${map.size} تصنيف.`);
  return map;
}

/* ------------------------------------------------------------ المستخدمون */

async function ensureUsers(
  admin: Admin,
  companyId: string,
  departments: Map<string, string>,
  password: string,
): Promise<Map<string, string>> {
  log.step('إنشاء المستخدمين التجريبيين');

  const userIds = new Map<string, string>();

  for (const user of DEMO_USERS) {
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id')
      .eq('email', user.email)
      .maybeSingle();

    let userId = existingProfile?.id;

    if (!userId) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: user.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: user.fullName },
      });

      if (error || !created.user) {
        log.warn(`تعذّر إنشاء ${user.email}: ${error?.message}`);
        continue;
      }
      userId = created.user.id;
    }

    await admin
      .from('profiles')
      .update({
        company_id: companyId,
        department_id: departments.get(user.departmentName) ?? null,
        full_name: user.fullName,
        email: user.email,
        job_title: user.jobTitle,
        role: user.role as UserRole,
        status: 'ACTIVE',
      })
      .eq('id', userId);

    userIds.set(user.email, userId);
    log.info(`${user.fullName} — ${user.email}`);
  }

  log.ok(`${userIds.size} مستخدم.`);
  return userIds;
}

/* ------------------------------------------------------------- المستندات */

async function ensureDocuments(
  admin: Admin,
  companyId: string,
  categories: Map<string, string>,
  departments: Map<string, string>,
  uploaderId: string,
): Promise<void> {
  log.step('رفع المستندات وفهرستها');

  // يُستورد هنا لأن خط المعالجة يعتمد على وحدات الخادم
  const { ingestDocument } = await import('../src/lib/rag/ingest');

  for (const document of DEMO_DOCUMENTS) {
    const { data: existing } = await admin
      .from('documents')
      .select('id, status')
      .eq('company_id', companyId)
      .eq('name', document.name)
      .maybeSingle();

    if (existing?.status === 'READY') {
      log.info(`${document.name} — مفهرس مسبقًا.`);
      continue;
    }

    const buffer = Buffer.from(document.content, 'utf8');

    const allowedDepartmentIds =
      document.visibility === 'DEPARTMENT'
        ? (document.departmentNames ?? [])
            .map((name) => departments.get(name))
            .filter((id): id is string => Boolean(id))
        : [];

    const documentId =
      existing?.id ??
      (
        await admin
          .from('documents')
          .insert({
            company_id: companyId,
            category_id: categories.get(document.categoryName) ?? null,
            name: document.name,
            description: document.description,
            file_type: 'text/plain',
            file_size_bytes: buffer.byteLength,
            status: 'PROCESSING',
            visibility: document.visibility,
            allowed_department_ids: allowedDepartmentIds,
            uploaded_by: uploaderId,
          })
          .select('id')
          .single()
      ).data?.id;

    if (!documentId) {
      log.warn(`تعذّر إنشاء سجل ${document.name}.`);
      continue;
    }

    const storagePath = `${companyId}/${documentId}/${document.name}`;

    const { error: uploadError } = await admin.storage
      .from('documents')
      .upload(storagePath, buffer, { contentType: 'text/plain', upsert: true });

    if (uploadError) {
      log.warn(`تعذّر رفع ${document.name}: ${uploadError.message}`);
      continue;
    }

    await admin
      .from('documents')
      .update({ storage_path: storagePath, status: 'PROCESSING', error_message: null })
      .eq('id', documentId);

    try {
      const result = await ingestDocument(documentId);
      log.info(`${document.name} — ${result.chunkCount} مقطع.`);
    } catch (error) {
      log.warn(
        `فشلت فهرسة ${document.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const { count } = await admin
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'READY');

  log.ok(`${count ?? 0} مستند جاهز للسؤال.`);
}

/* -------------------------------------------------------- فجوات المعرفة */

async function ensureKnowledgeGaps(
  admin: Admin,
  companyId: string,
  departments: Map<string, string>,
): Promise<void> {
  log.step('تسجيل فجوات المعرفة التجريبية');

  for (const gap of DEMO_KNOWLEDGE_GAPS) {
    const { data: normalized } = await admin.rpc('normalize_question', {
      p_text: gap.question,
    });

    const lastAsked = new Date();
    lastAsked.setDate(lastAsked.getDate() - Math.floor(Math.random() * 10));

    const firstAsked = new Date(lastAsked);
    firstAsked.setDate(firstAsked.getDate() - 30);

    await admin.from('knowledge_gaps').upsert(
      {
        company_id: companyId,
        question: gap.question,
        normalized_question: (normalized as unknown as string) ?? gap.question.toLowerCase(),
        times_asked: gap.timesAsked,
        department_id: departments.get(gap.department) ?? null,
        status: 'OPEN',
        first_asked_at: firstAsked.toISOString(),
        last_asked_at: lastAsked.toISOString(),
      },
      { onConflict: 'company_id,normalized_question', ignoreDuplicates: true },
    );
  }

  log.ok(`${DEMO_KNOWLEDGE_GAPS.length} فجوة معرفة.`);
}

/* ------------------------------------------------------ المحادثات الحقيقية */

async function ensureConversations(
  admin: Admin,
  companyId: string,
  userIds: Map<string, string>,
): Promise<void> {
  log.step('توليد المحادثات التجريبية');

  if (!process.env.ANTHROPIC_API_KEY) {
    log.warn(
      'ANTHROPIC_API_KEY غير مضبوط — تم تخطّي توليد المحادثات بدل اختلاق إجابات وهمية.',
    );
    log.info('اضبط المفتاح وأعد تشغيل السكربت لتوليد محادثات حقيقية.');
    return;
  }

  const { data: existing } = await admin
    .from('conversations')
    .select('id')
    .eq('company_id', companyId)
    .limit(1);

  if ((existing?.length ?? 0) > 0) {
    log.info('توجد محادثات مسبقًا — تم التخطّي.');
    return;
  }

  const { embedQuery, toPgVector } = await import('../src/lib/rag/embeddings');
  const { generateAnswer } = await import('../src/lib/ai/claude');
  const { buildSystemPrompt, buildUserMessage, isUnansweredResponse } = await import(
    '../src/lib/ai/prompts'
  );

  const askers = [...userIds.entries()].filter(([email]) => email.startsWith('employee'));
  if (askers.length === 0) {
    log.warn('لا يوجد موظفون لإنشاء محادثات.');
    return;
  }

  let created = 0;

  for (const [index, demo] of DEMO_QUESTIONS.entries()) {
    const [, userId] = askers[index % askers.length];

    const { data: conversation } = await admin
      .from('conversations')
      .insert({
        company_id: companyId,
        user_id: userId,
        title: demo.question.slice(0, 60),
      })
      .select('id')
      .single();

    if (!conversation) continue;

    await admin.from('messages').insert({
      company_id: companyId,
      conversation_id: conversation.id,
      user_id: userId,
      role: 'USER',
      content: demo.question,
    });

    // استرجاع حقيقي بنفس منطق الإنتاج.
    // دالة الإنتاج تشتق المستخدم من auth.uid() وهو غير متاح للسكربت،
    // لذا نستخدم نسخة مخصّصة لـ service_role تأخذ الشركة صراحةً.
    const embedding = await embedQuery(demo.question);

    const { data: ranked, error: rankError } = await admin.rpc('seed_match_chunks', {
      p_company_id: companyId,
      p_query_embedding: toPgVector(embedding),
      p_match_count: 6,
    });

    if (rankError) {
      log.warn(`تعذّر الاسترجاع لسؤال «${demo.question}»: ${rankError.message}`);
      continue;
    }

    const retrieved = (ranked ?? []).map((row) => ({
      chunkId: row.chunk_id,
      documentId: row.document_id,
      documentName: row.document_name,
      content: row.content,
      pageNumber: row.page_number,
      sectionTitle: row.section_title,
      similarity: row.similarity,
    }));

    const completion = await generateAnswer({
      systemPrompt: buildSystemPrompt({
        companyName: DEMO_COMPANY_NAME,
        tone: 'professional',
        userName: 'موظف',
        userRole: 'موظف',
        departmentName: null,
      }),
      history: [],
      userMessage: buildUserMessage(demo.question, retrieved),
    });

    const unanswered = retrieved.length === 0 || isUnansweredResponse(completion.text);

    const { data: assistantMessage } = await admin
      .from('messages')
      .insert({
        company_id: companyId,
        conversation_id: conversation.id,
        user_id: userId,
        role: 'ASSISTANT',
        content: completion.text,
        answer_status: unanswered ? 'UNANSWERED' : 'ANSWERED',
        model: completion.model,
        input_tokens: completion.inputTokens,
        output_tokens: completion.outputTokens,
        latency_ms: completion.latencyMs,
      })
      .select('id')
      .single();

    if (assistantMessage && !unanswered && retrieved.length > 0) {
      const seen = new Set<string>();
      const sources = retrieved.filter((chunk) => {
        const key = `${chunk.documentId}:${chunk.pageNumber ?? 'na'}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      await admin.from('message_sources').insert(
        sources.map((chunk) => ({
          company_id: companyId,
          message_id: assistantMessage.id,
          document_id: chunk.documentId,
          chunk_id: chunk.chunkId,
          document_name: chunk.documentName,
          page_number: chunk.pageNumber,
          section_title: chunk.sectionTitle,
          similarity: chunk.similarity,
          excerpt: chunk.content.slice(0, 240),
        })),
      );
    }

    created += 1;
    log.info(`${demo.question} — ${unanswered ? 'بلا إجابة' : 'مُجابة'}`);
  }

  log.ok(`${created} محادثة.`);
}

/* ------------------------------------------------------------ الاستهلاك */

async function ensureUsageRecords(admin: Admin, companyId: string): Promise<void> {
  log.step('تسجيل بيانات الاستهلاك');

  const { count: questionCount } = await admin
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('role', 'USER');

  const { count: documentCount } = await admin
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId);

  const periodMonth = new Date();
  periodMonth.setDate(1);

  await admin.from('usage_records').upsert(
    {
      company_id: companyId,
      period_month: periodMonth.toISOString().slice(0, 10),
      questions_count: questionCount ?? 0,
      documents_count: documentCount ?? 0,
    },
    { onConflict: 'company_id,period_month' },
  );

  log.ok('تم.');
}

/* ---------------------------------------------------------------- main */

async function main(): Promise<void> {
  console.log('\n═══════════════════════════════════════════');
  console.log('  معرفة AI — بيانات العرض التجريبية');
  console.log('  DEMO DATA — بيانات وهمية بالكامل');
  console.log('═══════════════════════════════════════════');

  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const password = process.env.DEMO_USER_PASSWORD || 'Ma3rifah!Demo2026';

  const admin = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (RESET) await resetDemoCompany(admin);

  const companyId = await ensureCompany(admin);
  await ensureSubscription(admin, companyId);

  const departments = await ensureDepartments(admin, companyId);
  const categories = await ensureCategories(admin, companyId);
  const userIds = await ensureUsers(admin, companyId, departments, password);

  const adminUserId = userIds.get('admin@demo.ma3rifah.ai');
  if (!adminUserId) {
    log.fail('تعذّر إنشاء حساب مدير الشركة التجريبية.');
    process.exit(1);
  }

  await ensureDocuments(admin, companyId, categories, departments, adminUserId);
  await ensureKnowledgeGaps(admin, companyId, departments);
  await ensureConversations(admin, companyId, userIds);
  await ensureUsageRecords(admin, companyId);

  console.log('\n═══════════════════════════════════════════');
  console.log('  اكتمل التجهيز');
  console.log('═══════════════════════════════════════════');
  console.log('\n  بيانات الدخول (تجريبية):');
  for (const user of DEMO_USERS) {
    console.log(`    ${user.email.padEnd(34)} ${user.fullName}`);
  }
  console.log(`\n  كلمة المرور الموحّدة: ${password}`);
  console.log('\n  جرّب الأسئلة التالية بعد تسجيل الدخول:');
  for (const demo of DEMO_QUESTIONS.slice(0, 6)) {
    console.log(`    • ${demo.question}`);
  }
  console.log('');
}

main().catch((error) => {
  log.fail(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
