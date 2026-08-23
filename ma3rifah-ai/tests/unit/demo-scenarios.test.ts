import { describe, expect, it } from 'vitest';
import {
  DEMO_COMPANY,
  DEMO_SCENARIOS,
  findScenario,
} from '../../src/content/demo-scenarios';
import { extractNumbers, verifyNumbers } from '../../src/lib/rag/verify';

/**
 * مشاهد العرض التجريبي.
 *
 * ما يُختبر هنا **صدق العرض** لا شكله. وثلاثة شروط:
 *
 *   • أن يبقى معلنًا أنه تجريبي، فلا يُقرأ بيانات عميل.
 *   • أن يبقى فيه مشهد **يفشل** — المساعد يقول «لم أجد». والعرض الذي كل
 *     إجاباته مثالية يُقرأ إعلانًا لا برهانًا، وحذفُ هذا المشهد إغراءٌ
 *     دائم لمن يريد عرضًا «أجمل».
 *   • أن يبقى فيه مشهد **يحذّر من رقم** — وهو ما لا يعرضه منافس، فحذفُه
 *     إسقاطٌ لأقوى ما نملك.
 */

describe('بنية المشاهد', () => {
  it('أربعة مشاهد على الأقل', () => {
    expect(DEMO_SCENARIOS.length).toBeGreaterThanOrEqual(4);
  });

  it('لكل مشهد معرّف فريد', () => {
    const ids = DEMO_SCENARIOS.map((scenario) => scenario.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('لكل مشهد سؤال وجواب ووسم قصير', () => {
    for (const scenario of DEMO_SCENARIOS) {
      expect(scenario.question.trim(), scenario.id).not.toBe('');
      expect(scenario.answer.trim(), scenario.id).not.toBe('');
      expect(scenario.chip.trim(), scenario.id).not.toBe('');
      // الوسم يوضع في شريط أزرار، فالطويل يكسر السطر على الجوال
      expect(scenario.chip.length, scenario.id).toBeLessThanOrEqual(18);
    }
  });
});

describe('صدق العرض', () => {
  it('اسم الشركة يعلن أنه تجريبي', () => {
    expect(DEMO_COMPANY).toContain('تجريبية');
  });

  it('فيه مشهد بلا إجابة — الاعتراف بالجهل معروض لا مخفيّ', () => {
    const unanswered = DEMO_SCENARIOS.filter((s) => s.outcome === 'UNANSWERED');
    expect(unanswered.length).toBeGreaterThanOrEqual(1);
    for (const scenario of unanswered) {
      expect(scenario.answer).toContain('لم أجد');
      // لا مصادر لجواب لم يُبنَ على شيء
      expect(scenario.sources).toHaveLength(0);
      expect(scenario.confidence).toBeNull();
    }
  });

  it('فيه مشهد يحذّر من رقم غير مؤكد', () => {
    const flagged = DEMO_SCENARIOS.filter((s) => s.outcome === 'FLAGGED');
    expect(flagged.length).toBeGreaterThanOrEqual(1);
    for (const scenario of flagged) {
      expect(scenario.note, scenario.id).not.toBeNull();
      expect(scenario.note!).toMatch(/لم يرد|غير مؤكد|راجع/);
    }
  });

  it('المشهد المُجاب له مصدر — لا جواب بلا سند', () => {
    for (const scenario of DEMO_SCENARIOS) {
      if (scenario.outcome === 'UNANSWERED') continue;
      expect(scenario.sources.length, scenario.id).toBeGreaterThan(0);
    }
  });

  it('كل مصدر له اسم وصفحة ومقطع', () => {
    for (const scenario of DEMO_SCENARIOS) {
      for (const source of scenario.sources) {
        expect(source.name.trim()).not.toBe('');
        expect(source.page).toBeGreaterThan(0);
        // المقطع هو ما يجعل العرض برهانًا لا ادّعاء
        expect(source.excerpt.length, `${scenario.id}/${source.name}`).toBeGreaterThan(40);
      }
    }
  });
});

/**
 * اتساق الأرقام يُقاس **بدالة المنتج نفسها** لا بنسخة محلية.
 *
 * والفرق جوهري: العرض يَعِد الزائر بأن المنصّة تكشف الرقم الذي لا أصل
 * له. فلو قِيس هنا بمنطق آخر، لصحّ العرض في الاختبار وكذب في المنتج —
 * وهو بالضبط ما يجب ألّا يحدث.
 *
 * وقد كانت هنا نسخة محلية تُعالج إعراب العدد («ثلاثون» و«ثلاثين»)،
 * فكشفت أن `verify.ts` لا تُعالجه. ونُقل العلاج إلى موضعه.
 */
function numbersIn(text: string): string[] {
  return [...extractNumbers(text)];
}

describe('اتساق الأرقام مع المصادر', () => {
  it('المشهد الموسوم «الأرقام مطابقة» رقمه في مقطعه فعلًا', () => {
    // لو ادّعى العرض مطابقةً لا تصحّ، لكان أول ما يُكتشف عند التدقيق
    const matched = DEMO_SCENARIOS.filter((s) => s.note === 'الأرقام مطابقة للمصدر');
    expect(matched.length).toBeGreaterThan(0);

    for (const scenario of matched) {
      const inSources = numbersIn(
        scenario.sources.map((source) => source.excerpt).join(' '),
      );
      const inAnswer = numbersIn(scenario.answer);

      expect(inAnswer.length, `${scenario.id}: لا رقم في الجواب`).toBeGreaterThan(0);
      for (const number of inAnswer) {
        expect(inSources, `${scenario.id}: العدد ${number} ليس في المصدر`).toContain(number);
      }
    }
  });

  it('المشهد المحذَّر يكشفه التحقق الحقيقي — لا الادّعاء وحده', () => {
    const flagged = DEMO_SCENARIOS.find((s) => s.outcome === 'FLAGGED');
    expect(flagged).toBeDefined();

    const result = verifyNumbers(
      flagged!.answer,
      flagged!.sources.map((source) => source.excerpt).join(' '),
    );

    // «ثلاثون» في الجواب ولا أثر لها في المصدر بأي صيغة — ولذلك التحذير
    expect(result.unverified).toContain('30');
  });
});

describe('إيجاد مشهد', () => {
  it('بالمعرّف الصحيح', () => {
    expect(findScenario(DEMO_SCENARIOS[0].id)?.id).toBe(DEMO_SCENARIOS[0].id);
  });

  it('والمجهول يعيد null', () => {
    expect(findScenario('la-yujad')).toBeNull();
  });
});
