import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * حارس استوديو السياسات والمكتبة المرجعية.
 *
 * الميزة تكتب نصًّا تنظيميًّا يصير — بعد اعتماده — لائحةَ شركةٍ يعمل
 * بها موظفوها. وثلاثة أخطاء تسقط الميزة كلها وهي لا تظهر في التشغيل:
 *
 *   • أن يُطلَب التنبيه القانوني من النموذج بدل إلحاقه برمجيًّا.
 *     الحاجز الذي يعتمد على امتثال نموذج ليس حاجزًا: يأتي في تسع
 *     مسوّدات ويغيب في العاشرة، وتلك التي يغيب فيها هي التي تُطبع.
 *   • أن يُفتح للنموذج بابٌ إلى معرفته العامة بالأنظمة، فينسب إلى
 *     «نظام العمل» مادةً لم يقرأها — والمدير يعتمدها لأنها تبدو دقيقة.
 *   • أن تتسرّب المكتبة إلى استرجاع المساعد العادي، فيقرأ الموظف نظامًا
 *     عامًّا بوصفه لائحة شركته.
 *
 * وكلها مفحوصة عمليًّا في `tests/sql/12` و`13`، وهذا الحارس يمسك ما
 * يسبق قاعدة البيانات: الموجّه والشيفرة.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const REFERENCE_MIGRATION = read('supabase/migrations/0039_policy_reference_library.sql');
const STUDIO_MIGRATION = read('supabase/migrations/0040_policy_studio.sql');
const STUDIO = read('src/lib/knowledge/policy-studio.ts');
const LIBRARY = read('src/lib/knowledge/reference-library.ts');
const PUBLISH = read('src/lib/knowledge/publish-policy.ts');
const ACTIONS = read('src/app/(dashboard)/policy-studio/actions.ts');

describe('المكتبة لا تلمس عزل الشركات', () => {
  it('لا تعدّل جداول المستندات ولا دوالّ الاسترجاع', () => {
    for (const forbidden of [
      'alter table public.documents',
      'alter table public.document_chunks',
      'create or replace function public.can_read_document',
      'create or replace function public.match_chunks_for_user',
    ]) {
      expect(
        REFERENCE_MIGRATION.includes(forbidden),
        `الهجرة تمسّ ${forbidden} — وهي بوابة عزل العملاء`,
      ).toBe(false);
    }
  });

  it('الكتابة محصورة في مالك المنصّة', () => {
    expect(REFERENCE_MIGRATION).toContain('using (public.is_super_admin())');
    expect(REFERENCE_MIGRATION).toContain('with check (public.is_super_admin())');
  });

  it('القراءة مشروطة بالنشر — لا استشهاد بنصٍّ نصفِ مفهرس', () => {
    expect(REFERENCE_MIGRATION).toContain("using (status = 'READY')");
  });

  it('جداول المكتبة بلا `company_id` — لا تُنسَب إلى شركة فتتسرّب إليها', () => {
    const block = REFERENCE_MIGRATION.slice(
      REFERENCE_MIGRATION.indexOf('create table if not exists public.platform_reference_documents'),
      REFERENCE_MIGRATION.indexOf('create table if not exists public.platform_reference_chunks'),
    );
    expect(block).not.toContain('company_id');
  });

  it('دالّة المكتبة تُرجع الجهة ورقم المرجع — مادةُ الاستشهاد الإلزامي', () => {
    expect(REFERENCE_MIGRATION).toContain('authority');
    expect(REFERENCE_MIGRATION).toContain('reference_code');
  });
});

describe('المسوّدة لا تصل موظفًا', () => {
  it('سياسة المسوّدات تشترط مدير الشركة وحدّ الشركة معًا', () => {
    expect(STUDIO_MIGRATION).toContain('public.belongs_to_current_company(company_id)');
    expect(STUDIO_MIGRATION).toContain('public.is_company_admin()');
  });

  it('قيد القاعدة يمنع اعتمادًا بلا معتمِد وتاريخ', () => {
    expect(STUDIO_MIGRATION).toContain('policy_drafts_approval_complete');
    expect(STUDIO_MIGRATION).toContain('approved_by is not null and approved_at is not null');
  });

  it('الحفظ والتأريخ في دالّة واحدة — لا نداءان يفترقان', () => {
    expect(STUDIO_MIGRATION).toContain('create or replace function public.save_policy_draft_version');
    expect(STUDIO_MIGRATION).toContain('insert into public.policy_draft_versions');
  });

  it('الدالّة لا تحرّر مسوّدة معتمدة', () => {
    expect(STUDIO_MIGRATION).toContain("status = 'DRAFT'");
  });
});

describe('التنبيه القانوني حاجز برمجي لا طلبٌ من النموذج', () => {
  it('النصّ ثابت في الشيفرة', () => {
    expect(STUDIO).toContain('export const POLICY_LEGAL_NOTICE');
    expect(STUDIO).toContain('تحتاج مراجعة مختص');
  });

  it('يُلحَق بالمسوّدة بعد التوليد', () => {
    expect(STUDIO).toMatch(/const body = `\$\{drafted\}[\s\S]*POLICY_LEGAL_NOTICE/);
  });

  it('الموجّه لا يطلب من النموذج كتابة التنبيه', () => {
    const system = STUDIO.slice(STUDIO.indexOf('const system ='), STUDIO.indexOf('const clarificationBlock'));
    expect(system).not.toContain('POLICY_LEGAL_NOTICE');
  });
});

describe('لا يُفتى من معرفة النموذج العامة', () => {
  it('الموجّه يمنع الاستناد إلى المعرفة العامة صراحةً', () => {
    expect(STUDIO).toContain('ولا تستعمل معرفتك العامة بالأنظمة السعودية مصدرًا');
  });

  it('الموجّه يوجب الاستشهاد لكل جملة تُنسب إلى نظام', () => {
    expect(STUDIO).toContain('يجب أن تُتبَع بمصدرها');
  });

  it('وما لا مصدر له يُكتب قرارًا داخليًّا لا حكمًا نظاميًّا', () => {
    expect(STUDIO).toContain('ولا تنسبه إلى نظام');
  });

  it('الموجّه يمنع اختراع المبالغ والمدد', () => {
    expect(STUDIO).toContain('لا تخترع مبلغًا ولا مدّة ولا نسبة');
  });

  it('الموجّه يمنع إصدار حكم بالمخالفة — مسؤولية لا ميزة', () => {
    expect(STUDIO).toContain('لست جهة إفتاء');
  });
});

describe('مدخلات المستخدم محيَّدة قبل الموجّه', () => {
  it('الموضوع وأجوبة المدير ووثائق الشركة والمراجع تمرّ بالتحييد', () => {
    const calls = STUDIO.match(/neutralizeChunkContent\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(6);
  });
});

describe('المكتبة لا تدخل المساعد العادي', () => {
  it('لا يستوردها إلا استوديو السياسات', () => {
    expect(STUDIO).toContain("from '@/lib/knowledge/reference-library'");
    // الملفّ الذي يخدم المحادثة لا يعرفها
    const chatService = read('src/lib/ai/chat-service.ts');
    expect(chatService).not.toContain('reference-library');
    expect(chatService).not.toContain('platform_reference');
  });

  it('معالج واتساب لا يعرفها أيضًا', () => {
    const whatsapp = read('src/lib/whatsapp/handler.ts');
    expect(whatsapp).not.toContain('platform_reference');
  });

  it('لا تُعاد صياغة النصّ النظامي عند الرفع — يُخزَّن كما رُفع', () => {
    expect(LIBRARY).not.toContain('generateAnswer');
  });
});

describe('النشر يمرّ بالأنبوب المثبَت', () => {
  it('السياسة تصير مستندًا لا نوع بيانات جديدًا', () => {
    expect(PUBLISH).toContain("source_kind: 'AUTHORED_POLICY'");
    expect(PUBLISH).toContain("from('document_chunks')");
  });

  it('حاجز يدوي ضدّ الخلط بين الشركات — مفتاح الخدمة يتجاوز RLS', () => {
    expect(PUBLISH).toContain('draft.company_id !== input.companyId');
  });

  it('المقاطع القديمة تُحذف قبل إعادة الفهرسة — لا نسختان للسياسة', () => {
    expect(PUBLISH).toMatch(/delete\(\)\s*\.eq\('document_id', documentId\)/);
  });
});

describe('الإجراءات محروسة', () => {
  it('كلها خلف صلاحية إدارة المستندات', () => {
    const guards = ACTIONS.match(/requirePermission\('documents\.manage'\)/g) ?? [];
    expect(guards.length).toBe(5);
  });

  it('النشر يسبق وسم الاعتماد — لا سياسة «معتمدة» لا يجدها أحد', () => {
    const approve = ACTIONS.slice(ACTIONS.indexOf('export async function approvePolicyDraftAction'));
    expect(approve.indexOf('publishPolicyDraft')).toBeLessThan(approve.indexOf("status: 'APPROVED'"));
  });

  it('توليد المسوّدة لا يُحسب على حصّة أسئلة الموظفين', () => {
    expect(ACTIONS).toContain('countsAsQuestion: false');
  });
});

describe('التخزين المؤقت لا يُسقط النداءات القصيرة', () => {
  const CLAUDE = read('src/lib/ai/claude.ts');

  /**
   * العطل الذي كشفه أول تشغيل: نقطة تخزين مؤقت على موجّه أقصر من حدّ
   * المزوّد الأدنى **يرفضها الطلب** ولا يتجاهلها. فسقط نداءا استوديو
   * السياسات معًا — وهما أول نداءين في المشروع بموجّه قصير — ووصل
   * المستخدمَ «الخدمة غير متاحة» بلا سبب ظاهر.
   *
   * والحارس هنا على الآلية لا على المسوّدة: أي مهمّة قادمة بموجّه قصير
   * تسقط السقوط نفسه، وهذا ما يمنعه.
   */
  it('التخزين مشروط بطول الموجّه', () => {
    expect(CLAUDE).toContain('MIN_CACHEABLE_PROMPT_CHARS');
    expect(CLAUDE).toMatch(/cacheable\s*=\s*params\.systemPrompt\.length >= MIN_CACHEABLE_PROMPT_CHARS/);
  });

  it('`cache_control` لا يُرسَل إلا إذا كان الموجّه قابلًا للتخزين', () => {
    expect(CLAUDE).toMatch(/\.\.\.\(cacheable \? \{ cache_control/);
  });

  it('موجّها استوديو السياسات دون الحدّ فعلًا — وهو سبب الحارس', () => {
    const questions = STUDIO.slice(STUDIO.indexOf('const system ='), STUDIO.indexOf('try {'));
    expect(questions.length).toBeLessThan(2000);
  });

  it('توليد المسوّدة يسجّل استهلاكًا حقيقيًّا لا أصفارًا', () => {
    expect(ACTIONS).toContain('result.usage.inputTokens');
    expect(ACTIONS).toContain('estimateCostUsd(');
    expect(ACTIONS).not.toContain('inputTokens: 0');
  });
});
