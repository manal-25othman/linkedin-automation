import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE_TEXT, defaultSiteText } from '../../src/content/site-text';

/**
 * حارس ضدّ المفتاح المسجَّل الذي لا يقرؤه أحد.
 *
 * محرِّر المحتوى يُبنى من السجلّ آليًا: كل مدخل فيه يظهر حقلًا في اللوحة.
 * فإن سُجّل مدخل ولم يُقرأ في أي صفحة، رأته المحرِّرة وعدّلته وحفظته —
 * ولم يتغيّر شيء على الموقع. وهذا أسوأ من غياب الحقل، لأنه يُفقد الثقة
 * بالمحرِّر كلّه لا بحقل واحد: من رأى تعديلًا لا يظهر لا يدري بعدها أيّ
 * تعديلاته ظهر.
 *
 * وقد وقع فعلًا: سُجّلت `security.controls` و`about.title` و`about.subtitle`
 * في السجلّ، وبقيت الصفحات تقرأ مصفوفاتها المكتوبة في الشيفرة. مرّ ذلك
 * لأن فحص الأنواع لا يرى علاقةً بين مدخلٍ في كائن ونصٍّ في صفحة.
 *
 * والفحص نصّي: يبحث عن المفتاح مقتبسًا في أي ملف مصدر خارج السجلّ
 * والمحرِّر. وهو فحص تقريبي — لا يثبت أن القراءة تعرض النصّ فعلًا — لكنه
 * يمسك الحالة التي وقعت: مدخلٌ لا يُذكر اسمه في أي مكان آخر إطلاقًا.
 */

const SRC = join(process.cwd(), 'src');

/** الملفات التي تذكر كل المفاتيح بحكم وظيفتها، فذكرها فيها ليس قراءة */
const NOT_A_READER = [
  'src/content/site-text.ts',
  'src/app/admin/content/content-client.tsx',
  'src/app/admin/content/page.tsx',
  'src/app/admin/actions.ts',
  'src/lib/content/site-text.ts',
];

function collectSourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...collectSourceFiles(path));
    else if (/\.(ts|tsx)$/.test(entry.name)) found.push(path);
  }
  return found;
}

const readerSources = collectSourceFiles(SRC)
  .filter((path) => !NOT_A_READER.includes(relative(process.cwd(), path)))
  .map((path) => readFileSync(path, 'utf8'));

function isReadSomewhere(key: string): boolean {
  return readerSources.some(
    (source) => source.includes(`'${key}'`) || source.includes(`"${key}"`),
  );
}

describe('سجلّ محتوى الموقع', () => {
  it('كل مدخل مسجَّل تقرؤه صفحة', () => {
    const orphans = Object.keys(SITE_TEXT).filter((key) => !isReadSomewhere(key));
    expect(orphans).toEqual([]);
  });

  it('الفحص نفسه يمسك مفتاحًا مهجورًا — ضبط سلبي', () => {
    expect(isReadSomewhere('home.this_key_does_not_exist')).toBe(false);
  });

  it('كل مفتاح يوافق صيغة قاعدة البيانات', () => {
    // نفس القيد في 0022 — مفتاح لا يوافقه يُرفض عند الحفظ لا عند البناء
    const pattern = /^[a-z0-9]+(\.[a-z0-9_]+)+$/;
    const invalid = Object.keys(SITE_TEXT).filter((key) => !pattern.test(key));
    expect(invalid).toEqual([]);
  });

  it('كل قائمة تسع في حدّ الطول المخزَّن', () => {
    const defaults = defaultSiteText();
    const tooLong = Object.entries(SITE_TEXT)
      .filter(([key, entry]) => {
        const limit = entry.kind === 'list' ? 200_000 : 5_000;
        return (defaults[key] ?? '').length > limit;
      })
      .map(([key]) => key);
    expect(tooLong).toEqual([]);
  });

  it('كل صفحة في السجلّ لها مدخلات فعلًا', () => {
    const pages = new Set(Object.values(SITE_TEXT).map((entry) => entry.page));
    for (const page of pages) expect(page.trim()).not.toBe('');
  });

  it('حقول القوائم لها أسماء فريدة داخل كل قائمة', () => {
    for (const [key, entry] of Object.entries(SITE_TEXT)) {
      if (entry.kind !== 'list') continue;
      const names = entry.fields.map((field) => field.name);
      expect(new Set(names).size, `تكرار في حقول ${key}`).toBe(names.length);
    }
  });

  it('كل صفّ في كل قائمة يملأ حقولها المعرَّفة', () => {
    // صفّ ينقصه حقل يعرضه المحرِّر فارغًا، وهو ما يظهر على الموقع فراغًا
    for (const [key, entry] of Object.entries(SITE_TEXT)) {
      if (entry.kind !== 'list') continue;
      const required = entry.fields
        .filter((field) => field.type !== 'toggle')
        .map((field) => field.name);
      entry.value.forEach((row, index) => {
        for (const field of required) {
          expect((row[field] ?? '').trim(), `${key}[${index}].${field}`).not.toBe('');
        }
      });
    }
  });
});
