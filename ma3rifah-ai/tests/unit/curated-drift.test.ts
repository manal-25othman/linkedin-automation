import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CURATED_LAM_ALEF } from '@/lib/rag/extract';

/**
 * قائمة العطب تعيش في موضعين: إصلاح TypeScript وفاحص SQL في لوحة
 * المنصّة (0034). إن أُضيفت كلمة لأحدهما ونُسي الآخر، صار الفاحص
 * يعلّم على ما لا يُصلَح — أو يسكت عمّا يُصلَح. هذا الحارس يربطهما.
 */

const MIGRATION = readFileSync(
  join(process.cwd(), 'supabase/migrations/0034_index_quality.sql'),
  'utf8',
);
const CHECK_SQL = readFileSync(
  join(process.cwd(), 'supabase/checks/03_corruption.sql'),
  'utf8',
);

/** الكلمات المعطوبة كما تعرفها الشيفرة (مع لفظَي العدد الأصليين) */
const TS_WORDS = new Set([
  ...CURATED_LAM_ALEF.map(([corrupted]) => corrupted),
  'ثالثين',
  'ثالثون',
]);

function sqlAlternation(source: string): Set<string> {
  // أطول بديلٍ بين علامتي اقتباس يحوي | وكلمات عربية
  const match = source.match(/'([ء-ي]+(?:\|[ء-ي]+)+)'/);
  expect(match, 'لم يُعثر على قائمة الكلمات في SQL').not.toBeNull();
  return new Set(match![1].split('|'));
}

describe('قائمة العطب واحدة في الموضعين', () => {
  for (const [label, source] of [
    ['ترحيلة 0034', MIGRATION],
    ['فاحص supabase/checks', CHECK_SQL],
  ] as const) {
    it(`${label} تطابق قائمة الشيفرة`, () => {
      const sqlWords = sqlAlternation(source);
      const missingInSql = [...TS_WORDS].filter(
        (word) => !['ثالثمئة', 'ثالثمائة'].includes(word) && !sqlWords.has(word),
      );
      const extraInSql = [...sqlWords].filter((word) => !TS_WORDS.has(word));
      expect(missingInSql, 'كلمات في الشيفرة غائبة عن SQL').toEqual([]);
      expect(extraInSql, 'كلمات في SQL لا تصلحها الشيفرة').toEqual([]);
    });
  }
});
