import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * صيغة المخاطبة.
 *
 * كُتبت الواجهة كلها بصيغة المخاطَبة المؤنّثة — «ارفعي» و«تواصلي» —
 * لأن صاحبة المنتج هي أول من قرأها. لكنّ المستخدم قد يكون أيّ أحد،
 * ومخاطبةُ رجلٍ بصيغة المؤنّث خطأٌ ظاهر في أول سطر يقرؤه.
 *
 * فوُحِّدت على المذكّر — وهو المحايد في الاستعمال العربي للواجهات.
 *
 * وهذا الحارس يمنع رجوعها: نصٌّ واحد بصيغة المؤنّث يمرّ في مراجعة،
 * ثم يصير موضعين، ثم يعود الموقع مختلطًا.
 */

const SOURCE_ROOT = join(process.cwd(), 'src');

/** أمرٌ للمخاطَبة المؤنّثة: الجذع + ياء (+ ضمير) */
const IMPERATIVES = [
  'ارفعي', 'اسألي', 'اكتبي', 'افتحي', 'اضغطي', 'جرّبي', 'أضيفي', 'شغّلي',
  'راجعي', 'انتظري', 'اختاري', 'حدّدي', 'ابدئي', 'أعيدي', 'أرسلي', 'تواصلي',
  'انسخي', 'الصقي', 'عدّلي', 'اقرئي', 'اطلبي', 'ادعي', 'فعّلي', 'أكملي',
  'تابعي', 'ابحثي', 'احذفي', 'تحقّقي', 'أنشئي', 'حاولي', 'تأكّدي', 'قسّمي',
];

/**
 * أسماءٌ تنتهي بـ«ين» وليست أفعالًا.
 *
 * بدونها يسقط الحارس على «تضمين» و«تخزين» و«تسعين» — والحارس الذي
 * يسقط على شيفرة سليمة يُعطَّل، فيصير كأنه غير موجود.
 */
const NOT_VERBS = new Set([
  'تعيين', 'تضمين', 'تخزين', 'تحسين', 'تخمين', 'تكوين', 'تسعين',
  'تدوين', 'تمكين', 'تأمين', 'تزيين', 'تحصين', 'تلقين', 'تبيين',
]);

const ARABIC = 'ء-ي';
const DIACRITICS = /[ً-ْٰ]/g;
const WORD = new RegExp(`[${ARABIC}ً-ْٰ]+`, 'g');
const PRESENT = new RegExp(`^[وفبسل]?ت[${ARABIC}]{2,}ين(ها|ه|هم|هن|نا)?$`);

function sourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) found.push(...sourceFiles(path));
    else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) found.push(path);
  }
  return found;
}

interface Hit {
  file: string;
  word: string;
}

function feminineHits(): Hit[] {
  const hits: Hit[] = [];
  for (const file of sourceFiles(SOURCE_ROOT)) {
    const text = readFileSync(file, 'utf8');
    const relative = file.replace(process.cwd(), '');

    for (const verb of IMPERATIVES) {
      const pattern = new RegExp(`(?<![${ARABIC}])[وف]?${verb}(?![${ARABIC}])`);
      if (pattern.test(text)) hits.push({ file: relative, word: verb });
    }

    for (const raw of text.match(WORD) ?? []) {
      const bare = raw.replace(DIACRITICS, '');
      // تُجرَّد السابقة واللاحقة قبل المقارنة: «تكوينه» اسمٌ بضمير
      // متّصل، ومقارنةُ الكلمة كاملةً تُفوّته فيسقط الحارس عليه
      const core = bare.replace(/^[وفبسل]/, '').replace(/(ها|هم|هن|نا|ه)$/, '');
      if (NOT_VERBS.has(core) || NOT_VERBS.has(bare)) continue;
      if (PRESENT.test(bare)) hits.push({ file: relative, word: raw });
    }
  }
  return hits;
}

describe('الواجهة تخاطب بالمذكّر', () => {
  it('لا صيغة أمرٍ للمخاطَبة المؤنّثة', () => {
    const hits = feminineHits().filter((hit) => IMPERATIVES.includes(hit.word));
    expect(
      hits.map((hit) => `${hit.file} → ${hit.word}`),
      'صيغة مؤنّثة عادت إلى الواجهة',
    ).toEqual([]);
  });

  it('لا صيغة مضارعٍ للمخاطَبة المؤنّثة', () => {
    const hits = feminineHits().filter((hit) => !IMPERATIVES.includes(hit.word));
    expect(hits.map((hit) => `${hit.file} → ${hit.word}`)).toEqual([]);
  });

  /**
   * ضابط موجب: لو أُعيدت تسمية الملفات أو خلا المشروع من العربية
   * لصار الحارس يمرّ دائمًا وهو لا يفحص شيئًا.
   */
  it('يفحص ملفّات فيها عربية أصلًا', () => {
    const arabic = sourceFiles(SOURCE_ROOT).filter((file) =>
      /[ء-ي]/.test(readFileSync(file, 'utf8')),
    );
    expect(arabic.length).toBeGreaterThan(50);
  });

  it('لا يسقط على الأسماء المنتهية بـ«ين»', () => {
    // ضابط سالب: هذه كلمات سليمة ويجب ألّا يعدّها أفعالًا
    for (const noun of ['تضمين', 'تخزين', 'تسعين', 'تعيين']) {
      expect(PRESENT.test(noun) && !NOT_VERBS.has(noun)).toBe(false);
    }
  });
});
