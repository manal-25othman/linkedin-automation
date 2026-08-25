import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * هيئة صفحات التسويق الداكنة.
 *
 * الأهمّ هنا ليس أن الداكن طُبِّق، بل **أين لم يُطبَّق**: قاعدة صاحبة
 * المنتج صريحة — «لا تعيد تصميم الـDashboard الحالية ولا تغيّر شكلها
 * الأساسي». ولوّنُ الصفحة التسويقية يُغري بتعديل رموز `.dark` أو
 * `:root` لأنها أقصر طريق، وهي مشتركة مع اللوحة — فتتغيّر اللوحة معها
 * بلا أن يقصد أحد.
 *
 * فالرموز مُعادة في صنفٍ خاصّ، وهذا الحارس يمنع تسرّبها.
 */

const CSS = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
const LAYOUT = readFileSync(
  join(process.cwd(), 'src/app/(marketing)/layout.tsx'),
  'utf8',
);

/** رموز الوضع الفاتح كما كانت قبل الهيئة الداكنة — أساس هوية اللوحة */
const DASHBOARD_LIGHT = {
  '--background': '0 0% 100%',
  '--primary': '218 55% 26%',
  '--gold': '40 48% 42%',
  '--radius': '0.5rem',
};

function blockOf(selector: string): string {
  const start = CSS.indexOf(`${selector} {`);
  expect(start, `${selector} غير موجود`).toBeGreaterThan(-1);
  return CSS.slice(start, CSS.indexOf('\n  }', start));
}

describe('اللوحة لم تتغيّر', () => {
  it.each(Object.entries(DASHBOARD_LIGHT))(
    'الوضع الفاتح يحتفظ بـ%s',
    (token, value) => {
      const root = blockOf(':root');
      expect(root, `${token} تغيّر — واللوحة تقرأ هذا الرمز`).toContain(
        `${token}: ${value};`,
      );
    },
  );

  it('الكحليّ ما زال أساس الهوية على الفاتح — لا الذهبيّ', () => {
    // لو صار `--primary` ذهبيًّا في `:root` لتغيّرت أزرار اللوحة كلها
    expect(blockOf(':root')).toContain('--primary: 218 55% 26%;');
  });

  it('الوضع الداكن للوحة لم يُمَسّ', () => {
    expect(blockOf('.dark')).toContain('--primary: 214 80% 62%;');
  });
});

describe('الهيئة التسويقية قائمة ومطبَّقة', () => {
  it('الصنف معرَّف', () => {
    expect(CSS).toContain('.marketing-shell {');
    expect(CSS).toContain('.dark .marketing-shell {');
  });

  it('تخطيط التسويق وحده يطبّقه', () => {
    expect(LAYOUT).toContain('marketing-shell');
  });

  it('أرضها داكنة فعلًا — لا وراثة من الفاتح', () => {
    const shell = blockOf('.dark .marketing-shell');
    const background = shell.match(/--background: \d+ \d+% (\d+)%;/);
    expect(background).not.toBeNull();
    expect(Number(background![1]), 'الأرض ليست داكنة').toBeLessThan(15);
  });

  it('تُعلن `color-scheme` — وإلا بقيت الحقول وأشرطة التمرير فاتحة', () => {
    expect(blockOf('.dark .marketing-shell')).toContain('color-scheme: dark');
  });

  it('كل رمز في الفاتح له نظير هنا — والناقص يرث لونًا لا يُرى', () => {
    const root = blockOf(':root');
    const shell = blockOf('.dark .marketing-shell');
    const tokens = [...root.matchAll(/(--[a-z-]+):/g)].map((match) => match[1]);
    const missing = tokens.filter(
      (token) => token !== '--radius' && !shell.includes(`${token}:`),
    );
    expect(missing, 'رموز بلا نظير داكن').toEqual([]);
  });
});

/**
 * الوضعان معًا.
 *
 * طلبت صاحبة المنتج دعم الفاتح والداكن بعد أن كانت الصفحة داكنة قسرًا.
 * والخطر في هذا التحويل واحد: **الومضة**. لو حُسمت السمة في React
 * لرُسمت الصفحة بيضاء ثم انقلبت أمام الزائر — وهي أسوأ ما في الوضع
 * الداكن، ويراها كل زائر في كل زيارة.
 *
 * فالحسم في نصٍّ داخل `<head>` قبل الرسم، وهذا الحارس يمنع نقله.
 */
describe('السمة تُحسم قبل الرسم', () => {
  const ROOT_LAYOUT = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8');
  const TOGGLE = readFileSync(
    join(process.cwd(), 'src/components/marketing/theme-toggle.tsx'),
    'utf8',
  );

  it('نصّ السمة في التخطيط الجذر لا في مكوّن عميل', () => {
    expect(ROOT_LAYOUT).toContain("localStorage.getItem('theme')");
    expect(ROOT_LAYOUT).toContain('prefers-color-scheme: dark');
  });

  it('الاختيار المحفوظ يسبق تفضيل الجهاز', () => {
    // لو انعكس الترتيب لضاع قرار الزائر الصريح في كل زيارة
    expect(ROOT_LAYOUT).toMatch(/var s=localStorage[\s\S]{0,120}s\?s==='dark':matchMedia/);
  });

  it('المبدّل يقرأ الحالة ولا يقرّرها', () => {
    expect(TOGGLE).toContain("classList.contains('dark')");
    expect(TOGGLE).not.toContain('prefers-color-scheme');
  });

  it('المبدّل لا يرسم أيقونة قبل أن يعرف — وإلا انقلبت أمام الزائر', () => {
    expect(TOGGLE).toContain('dark === null');
  });

  it('التخزين الممنوع لا يكسر القلب', () => {
    expect(TOGGLE).toMatch(/try \{[\s\S]{0,160}catch/);
  });

  it('`colorScheme` يُضبط مع الصنف — وإلا بقيت الحقول من السمة الأخرى', () => {
    expect(ROOT_LAYOUT).toContain('colorScheme');
    expect(TOGGLE).toContain('colorScheme');
  });
});
