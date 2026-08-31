import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * وكيل الفجوات — الحدود التي لا يتجاوزها.
 *
 * الوكيل يقترح مسوّدةً والمدير يعتمد. الضمانة ليست في النيّة بل في
 * الشيفرة: دالّة الاقتراح لا تملك مسار كتابةٍ أصلًا — لا تحفظ إجابة،
 * ولا تغيّر حالة فجوة، ولا تنشئ مستندًا. فتعديلٌ لاحق يجعلها «تحفظ
 * تلقائيًا لتسهيل العمل» يسقط هنا قبل أن يصل قاعدةَ معرفةٍ يقرؤها
 * كل موظفي العميل.
 */

const SOURCE = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/knowledge-gaps/actions.ts'),
  'utf8',
);

/** نصّ دالّة الاقتراح وحدها */
function suggestBody(): string {
  const start = SOURCE.indexOf('export async function suggestGapAnswerAction');
  expect(start, 'دالّة الاقتراح غير موجودة').toBeGreaterThan(-1);
  // نهايتها: بداية دالّة مصدَّرة تالية أو نهاية الملف
  const rest = SOURCE.slice(start + 10);
  const next = rest.search(/export (async )?function /);
  return next === -1 ? SOURCE.slice(start) : SOURCE.slice(start, start + 10 + next);
}

describe('وكيل الفجوات يقترح ولا يقرّر', () => {
  const body = suggestBody();

  it('لا يكتب شيئًا — لا update ولا insert ولا upsert', () => {
    expect(body).not.toMatch(/\.update\(/);
    expect(body).not.toMatch(/\.insert\(/);
    expect(body).not.toMatch(/upsertCuratedAnswer/);
    expect(body).not.toMatch(/\.delete\(/);
  });

  it('محميّ بالصلاحية نفسها التي تحمي معالجة الفجوات', () => {
    expect(body).toContain("requirePermission('knowledge_gaps.manage')");
  });

  it('محدود المعدّل — فلا يُستنزف المفتاح بضغطٍ متكرر', () => {
    expect(body).toContain('enforceRateLimit');
  });

  it('لا يُحتسب على حصّة أسئلة الموظفين، وتكلفته تُسجَّل', () => {
    expect(body).toContain('countsAsQuestion: false');
    expect(body).toContain('recordAiUsage');
  });

  it('يستعمل موجّه المحادثة المحصَّن — لا موجّهًا جديدًا بلا حماية حقن', () => {
    expect(body).toContain('buildSystemPrompt');
    expect(body).toContain('buildUserMessage');
  });

  it('يملك مخرج «لم أجد» الصادق بدل الاختراع', () => {
    expect(body).toContain('isUnansweredResponse');
    expect(body).toContain('retrieval.isEmpty');
  });

  /** ضابط سالب: الفاحص يقرأ الدالّة الصحيحة فعلًا لا نصًّا فارغًا */
  it('ضابط موجب: جسم الدالّة يحوي منطق الاسترجاع', () => {
    expect(body).toContain('retrieveRelevantChunks');
    expect(body.length).toBeGreaterThan(1000);
  });
});
