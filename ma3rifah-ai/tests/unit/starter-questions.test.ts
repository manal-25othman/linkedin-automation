import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  STARTER_QUESTIONS_MAX,
  aiSettingsSchema,
  parseStarterQuestions,
} from '@/lib/validation/schemas';

/**
 * أسئلة البداية — شرائح فوق صندوق المساعد يكتبها مدير الشركة.
 *
 * كانت الشرائح ثابتة في الشيفرة وعامّة (إجازات، عمل عن بعد…) فقد تسأل
 * عن شيء ليس في مستندات الشركة أصلًا، فيكون أول ما يراه المستخدم
 * «لم أجد». الآن يكتبها المدير من الإعدادات، والافتراضية لمن لم يكتب.
 */

const CHAT = readFileSync(
  join(process.cwd(), 'src/components/dashboard/assistant/chat.tsx'),
  'utf8',
);
const SHELL = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/assistant/assistant-shell.tsx'),
  'utf8',
);
const FORM = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/settings/settings-forms.tsx'),
  'utf8',
);
const ACTION = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/settings/actions.ts'),
  'utf8',
);

const BASE = {
  tone: 'professional' as const,
  retrieval_top_k: 8,
  min_similarity: 0.3,
  max_context_chunks: 6,
  history_window: 6,
  allow_general_knowledge: false,
};

describe('تحليل نص المربّع', () => {
  it('سطر لكل سؤال، ويُسقط الفراغ والتكرار ويحفظ الترتيب', () => {
    expect(parseStarterQuestions('  أ؟ \r\n\n ب؟\nأ؟\n   \nج؟')).toEqual(['أ؟', 'ب؟', 'ج؟']);
  });

  it('الفراغ وnull يعطيان قائمة فارغة لا خطأ', () => {
    expect(parseStarterQuestions('')).toEqual([]);
    expect(parseStarterQuestions(null)).toEqual([]);
    expect(parseStarterQuestions(undefined)).toEqual([]);
  });
});

describe('مخطّط التحقق', () => {
  it('غياب الحقل مقبول ويُخزَّن قائمةً فارغة — الإعدادات القديمة لا تنكسر', () => {
    const parsed = aiSettingsSchema.safeParse(BASE);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.starter_questions).toEqual([]);
  });

  it(`أكثر من ${STARTER_QUESTIONS_MAX} أسئلة يُرفض`, () => {
    const tooMany = Array.from({ length: STARTER_QUESTIONS_MAX + 1 }, (_, i) => `سؤال رقم ${i}؟`);
    expect(aiSettingsSchema.safeParse({ ...BASE, starter_questions: tooMany }).success).toBe(false);
    expect(
      aiSettingsSchema.safeParse({ ...BASE, starter_questions: tooMany.slice(0, STARTER_QUESTIONS_MAX) })
        .success,
    ).toBe(true);
  });

  it('السؤال القصير جدًا أو الطويل جدًا يُرفض', () => {
    expect(aiSettingsSchema.safeParse({ ...BASE, starter_questions: ['أب'] }).success).toBe(false);
    expect(aiSettingsSchema.safeParse({ ...BASE, starter_questions: ['س'.repeat(161)] }).success).toBe(
      false,
    );
    expect(aiSettingsSchema.safeParse({ ...BASE, starter_questions: ['س'.repeat(160)] }).success).toBe(
      true,
    );
  });

  it('حدّ الثمانية في المخطّط هو الحدّ المعروض في الواجهة', () => {
    // الرقم الذي يقرأه المدير تحت المربّع يأتي من الثابت نفسه لا من نصّ منسوخ
    expect(FORM).toContain('{STARTER_QUESTIONS_MAX}');
    expect(STARTER_QUESTIONS_MAX).toBe(8);
  });
});

describe('الربط من الإعدادات إلى المساعد', () => {
  it('الإجراء يقرأ الحقل عبر parseStarterQuestions لا String() مباشرة', () => {
    expect(ACTION).toContain("parseStarterQuestions(formData.get('starter_questions'))");
  });

  it('النموذج يعرض القيم المحفوظة سطرًا لكل سؤال', () => {
    expect(FORM).toContain('name="starter_questions"');
    expect(FORM).toContain("(settings.starter_questions ?? []).join('\\n')");
  });

  it('الهيكل يمرّر أسئلة الشركة، والمحادثة تعود للافتراضية حين تفرغ', () => {
    expect(SHELL).toContain('starterQuestions={starterQuestions}');
    expect(CHAT).toContain(
      'starterQuestions.length > 0 ? starterQuestions : DEFAULT_STARTER_QUESTIONS',
    );
    // لا قائمة ثابتة أخرى تُعرض متجاوزةً ما كتبه المدير
    expect(CHAT).not.toMatch(/\bSUGGESTIONS\b/);
  });
});
