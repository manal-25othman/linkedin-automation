import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SITE_TEXT } from '@/content/site-text';

/**
 * قسم المقارنة.
 *
 * المقارنة أخطر أقسام الصفحة صياغةً: هي الموضع الذي يُغري بادّعاءٍ عن
 * منافس لا نملك إثباته، أو بوعدٍ عن أنفسنا لم يُبنَ بعد.
 *
 * فالحارس على شيئين: أن النصّ يبقى في سجلّ المحتوى لتملكه صاحبة
 * المنتج، وأن كل سطرٍ في عمودنا يقابله شيءٌ قائم في الشيفرة.
 */

const SOURCE = readFileSync(join(process.cwd(), 'src/components/marketing/comparison.tsx'), 'utf8');
const PAGE = readFileSync(join(process.cwd(), 'src/app/(marketing)/page.tsx'), 'utf8');

const rows = SITE_TEXT['home.compare.rows'].value as {
  aspect: string;
  generic: string;
  ours: string;
}[];

describe('النصّ في السجلّ لا في الشيفرة', () => {
  it('القسم يقرأ من المفتاح', () => {
    expect(PAGE).toContain("t.list('home.compare.rows')");
    expect(PAGE).toContain('<Comparison');
  });

  it('لا سطر منسوخ إلى المكوّن', () => {
    for (const row of rows) {
      expect(SOURCE, `«${row.aspect}» نُسخ إلى الشيفرة`).not.toContain(row.aspect);
      expect(SOURCE).not.toContain(row.ours);
    }
  });
});

describe('لا ادّعاء بلا سند', () => {
  it('ستة جوانب على الأقل — وإلا فالمقارنة ناقصة', () => {
    expect(rows.length).toBeGreaterThanOrEqual(6);
  });

  it('كل جانب له طرفان مكتوبان', () => {
    for (const row of rows) {
      expect(row.aspect.length).toBeGreaterThan(3);
      expect(row.generic.length).toBeGreaterThan(10);
      expect(row.ours.length).toBeGreaterThan(10);
    }
  });

  it('لا رقم استخدام ولا نسبة ولا اسم منافس', () => {
    // الأرقام في المقارنة تُقرأ إحصاءةً، ولا إحصاءة عندنا
    const all = rows.map((r) => `${r.generic} ${r.ours}`).join(' ');
    expect(all).not.toMatch(/\d+\s*%|٪/);
    expect(all).not.toMatch(/ChatGPT|Copilot|Gemini|جيميناي|شات جي/i);
  });

  it('لا وعد بما ليس في المنتج', () => {
    const all = rows.map((r) => r.ours).join(' ');
    for (const banned of ['قريبًا', 'سنضيف', 'نخطّط', 'AI Agent']) {
      expect(all, banned).not.toContain(banned);
    }
  });
});

describe('يُقرأ على الهاتف كما على الحاسب', () => {
  it('ليس جدولًا — الجدول ينزلق أو يُضغط', () => {
    expect(SOURCE).not.toContain('<table');
  });

  it('لكل خانة تسميتها، فلا يلتبس الطرفان بلا رأس أعمدة', () => {
    expect(SOURCE).toMatch(/label=\{?["']أداة عامة/);
    expect(SOURCE).toMatch(/label=\{?["']معرفة AI/);
  });

  it('التسمية تبقى مسموعة على الحاسب — لا تُحذف من شجرة الوصول', () => {
    // `lg:hidden` يُخرجها من شجرة الوصول، و`lg:sr-only` يبقيها
    expect(SOURCE).toContain('lg:sr-only');
    expect(SOURCE).not.toMatch(/text-xs font-medium lg:hidden/);
  });

  it('رأس الأعمدة لا يستعمل `sr-only` في خانته الأولى', () => {
    // `sr-only` مطلق الموضع فيخرج من الشبكة، فتنزلق التسميتان عمودًا
    // يُفحَص الصنف لا ذكرُ الاسم: التعليق فوقه يشرح سبب تجنّبه،
    // فالبحث عن النصّ المجرّد يلتقط الشرح ويسقط على شيفرة سليمة
    const header = SOURCE.slice(SOURCE.indexOf('رأس الأعمدة'), SOURCE.indexOf('overflow-hidden'));
    expect(header).not.toContain('className="sr-only"');
    expect(header).toContain('aria-hidden />');
  });
});
