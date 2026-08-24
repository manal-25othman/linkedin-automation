import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SITE_TEXT } from '@/content/site-text';

/**
 * عرض المميزات — ما يجب ألّا يضيع حين يتحوّل الرصّ إلى ألسنة.
 *
 * الخطر في هذا النمط ليس الشكل بل الصمت: يُصيَّر اللوح النشط وحده،
 * فيسقط ثلثا النصّ من الصفحة. ولا يظهر ذلك في متصفّح — الشاشة تبدو
 * أجمل — بل في محرّك البحث الذي لا يجد الكلمات، وفي قارئ الشاشة الذي
 * يتصفّح النصّ فلا يرى إلا ثلثه.
 *
 * فالحارس على المصدر: كل الألواح تُصيَّر، والمخفيّ يُخفى بسمة `hidden`
 * لا بحذفه من الشجرة.
 */

const SOURCE = readFileSync(
  join(process.cwd(), 'src/components/marketing/feature-showcase.tsx'),
  'utf8',
);
const PAGE = readFileSync(join(process.cwd(), 'src/app/(marketing)/page.tsx'), 'utf8');

describe('لا يضيع محتوى', () => {
  it('كل الألواح تُصيَّر — لا اللوح النشط وحده', () => {
    // لوحان اثنان يُبنيان بالتكرار: الألسنة والألواح
    const loops = SOURCE.match(/items\.map\(/g) ?? [];
    expect(loops.length, 'الألسنة والألواح كلاهما بالتكرار').toBe(2);
  });

  it('الإخفاء بسمة `hidden` لا بحذف من الشجرة', () => {
    expect(SOURCE).toMatch(/hidden=\{index !== active\}/);
    // الصيغة التي تحذف: {index === active && ...} أو ternary تُرجع null
    expect(SOURCE).not.toMatch(/index === active \?\s*\(/);
  });

  it('الشرح كلّه يخرج من قائمة المحتوى لا من الشيفرة', () => {
    const cards = SITE_TEXT['home.diff.cards'];
    expect(cards.kind).toBe('list');
    const values = cards.value as { title: string; description: string }[];
    expect(values.length).toBeGreaterThanOrEqual(3);
    for (const card of values) {
      // لو نُسخ نصّ إلى الشيفرة لانفصل عن محرّر المحتوى
      expect(SOURCE).not.toContain(card.title);
      expect(PAGE).not.toContain(card.title);
    }
  });
});

describe('يُستعمل ولا يبقى معطّلًا', () => {
  it('الصفحة تستدعيه فعلًا', () => {
    expect(PAGE).toContain('<FeatureShowcase');
    expect(PAGE).toContain("t.list('home.diff.cards')");
  });

  it('البطاقات المرصوصة القديمة أُزيلت — لا نسختان للقسم نفسه', () => {
    const diffSection = PAGE.slice(
      PAGE.indexOf("home.diff.eyebrow"),
      PAGE.indexOf("home.steps.eyebrow"),
    );
    expect(diffSection).not.toContain('<article');
  });
});

describe('الوصول وإمكانية الاستعمال', () => {
  it('نمط الألسنة القياسي — لا أزرار عارية', () => {
    for (const attribute of ['role="tablist"', 'role="tab"', 'role="tabpanel"', 'aria-selected']) {
      expect(SOURCE, attribute).toContain(attribute);
    }
  });

  it('اللسان النشط وحده في تسلسل التنقّل', () => {
    expect(SOURCE).toContain('tabIndex={selected ? 0 : -1}');
  });

  it('الأسهم معكوسة للعربية — اليسار يتقدّم', () => {
    expect(SOURCE).toMatch(/ArrowLeft'\s*\?\s*1/);
  });

  it('يقف عند التحويم والتركيز — لا يقاطع القارئ', () => {
    expect(SOURCE).toContain('onMouseEnter');
    expect(SOURCE).toContain('onFocusCapture');
  });

  it('يحترم تفضيل تقليل الحركة', () => {
    expect(SOURCE).toContain('prefers-reduced-motion');
    // ولا يتقدّم أصلًا حين يُطلب السكون
    expect(SOURCE).toMatch(/if \(paused \|\| !motionOk/);
  });
});

describe('شريط التقدّم لا يكذب', () => {
  it('مدّته من ثابت الشيفرة لا من رقم مكتوب في CSS', () => {
    expect(SOURCE).toMatch(/animationDuration: `\$\{ADVANCE_MS\}ms`/);
  });

  it('الحركة معطّلة عند تفضيل تقليل الحركة', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toContain('.showcase-progress');
  });
});
