import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  HELP_ARTICLES,
  HELP_CATEGORIES,
  findHelpArticle,
  helpByCategory,
  searchHelp,
} from '../../src/content/help';
import { parseRichText } from '../../src/lib/content/rich-text';

/**
 * دليل الاستخدام.
 *
 * أخطر ما في دليل مكتوب باليد **رابطٌ ميّت**: من ضغطه بحثًا عن مساعدة
 * وصل صفحة «غير موجودة» — فيخرج بانطباع أسوأ من الذي دخل به، ويصير
 * الدليل سببًا لتذكرة دعم لا علاجًا لها.
 *
 * ولذلك يُفحَص كل رابط داخلي في كل مقال مقابل مسارات التطبيق الحقيقية.
 * وهو فحصٌ يمسك ما لا تمسكه المراجعة البشرية: مسارٌ أُعيدت تسميته بعد
 * كتابة المقال بشهور.
 */

const APP_DIR = join(process.cwd(), 'src/app');

/** مسارات معروفة خارج مجلد اللوحة */
const KNOWN_ROUTES = new Set(['/', '/login', '/register', '/security', '/pricing']);

function routeExists(path: string): boolean {
  if (KNOWN_ROUTES.has(path)) return true;

  const clean = path.split('#')[0].replace(/^\//, '');
  // المسارات كلها تحت مجموعتَي التوجيه — ومجموعة التوجيه لا تظهر في العنوان
  return (
    existsSync(join(APP_DIR, '(dashboard)', clean, 'page.tsx')) ||
    existsSync(join(APP_DIR, '(marketing)', clean, 'page.tsx')) ||
    existsSync(join(APP_DIR, clean, 'page.tsx'))
  );
}

describe('بنية الدليل', () => {
  it('فيه مقالات فعلًا — ضابط موجب', () => {
    expect(HELP_ARTICLES.length).toBeGreaterThanOrEqual(10);
  });

  it('كل مقال له معرّف فريد', () => {
    const slugs = HELP_ARTICLES.map((article) => article.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('المعرّفات صالحة للعناوين', () => {
    for (const article of HELP_ARTICLES) {
      expect(article.slug, article.title).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('كل مقال يحمل عنوانًا وملخّصًا ومتنًا', () => {
    for (const article of HELP_ARTICLES) {
      expect(article.title.trim()).not.toBe('');
      expect(article.summary.trim()).not.toBe('');
      expect(article.body.trim().length).toBeGreaterThan(100);
    }
  });

  it('كل مقال ينتمي إلى قسم معروف', () => {
    const known = new Set<string>(HELP_CATEGORIES);
    for (const article of HELP_ARTICLES) {
      expect(known.has(article.category), `${article.slug}: ${article.category}`).toBe(true);
    }
  });

  it('كل قسم معلَن فيه مقال — لا قسم فارغ في الفهرس', () => {
    const groups = helpByCategory();
    for (const group of groups) expect(group.articles.length).toBeGreaterThan(0);
    expect(groups.length).toBe(HELP_CATEGORIES.length);
  });
});

describe('روابط المقالات', () => {
  it('كل رابط داخلي يشير إلى صفحة موجودة', () => {
    const broken: string[] = [];

    for (const article of HELP_ARTICLES) {
      for (const match of article.body.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
        const href = match[2];
        if (!href.startsWith('/')) continue;
        if (!routeExists(href)) broken.push(`${article.slug} → ${href}`);
      }
    }

    expect(broken).toEqual([]);
  });

  it('الفحص يرى روابط فعلًا — ضابط موجب', () => {
    // فحصٌ لا يجد رابطًا واحدًا يمرّ دائمًا ولا يثبت شيئًا
    const links = HELP_ARTICLES.flatMap((article) => [
      ...article.body.matchAll(/\[([^\]]+)\]\((\/[^)\s]+)\)/g),
    ]);
    expect(links.length).toBeGreaterThan(8);
  });

  it('الفحص يمسك مسارًا غير موجود — ضبط سلبي', () => {
    expect(routeExists('/la-yujad-hatha-al-masar')).toBe(false);
  });
});

describe('عرض المتن', () => {
  it('كل متن يُحلَّل إلى كتل — لا مقال يظهر فارغًا', () => {
    for (const article of HELP_ARTICLES) {
      expect(parseRichText(article.body).length, article.slug).toBeGreaterThan(1);
    }
  });

  it('لا وسوم HTML خامة في المتون', () => {
    // العارض يهرّبها فتظهر نصًّا مشوّهًا للقارئ
    for (const article of HELP_ARTICLES) {
      expect(article.body, article.slug).not.toMatch(/<\/?(div|span|script|a|p)\b/i);
    }
  });
});

describe('البحث', () => {
  it('يجد بالعنوان', () => {
    expect(searchHelp('فجوات').map((a) => a.slug)).toContain('knowledge-gaps');
  });

  it('يجد بالكلمات المفتاحية ولو لم ترد في النص', () => {
    expect(searchHelp('pdf').map((a) => a.slug)).toContain('upload-documents');
  });

  it('يرتّب تطابق العنوان قبل تطابق المتن', () => {
    const results = searchHelp('المستندات');
    expect(results.length).toBeGreaterThan(1);
    expect(results[0].title).toContain('المستندات');
  });

  it('الاستعلام الفارغ لا يعيد كل شيء', () => {
    // إعادة الكل تجعل الفهرس يقفز إلى «نتائج» بلا بحث
    expect(searchHelp('')).toEqual([]);
    expect(searchHelp('   ')).toEqual([]);
  });

  it('ما لا يطابق يعيد فراغًا', () => {
    expect(searchHelp('زقنبوت')).toEqual([]);
  });
});

describe('إيجاد مقال', () => {
  it('بالمعرّف الصحيح', () => {
    expect(findHelpArticle('getting-started')?.title).toContain('كيف أبدأ');
  });

  it('والمعرّف المجهول يعيد null لا يرمي', () => {
    expect(findHelpArticle('la-yujad')).toBeNull();
  });
});
