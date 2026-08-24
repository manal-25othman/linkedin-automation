import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * حارس لوحة الألوان.
 *
 * تغيير اللون الأساسي من الأخضر المزرقّ إلى الكحليّ كشف صنفين مكتوبين
 * مباشرةً — `bg-teal-700` وأخواته في بطاقة محادثة الزائر وصفحة التهيئة.
 * وهي لا تمرّ برموز النظام، فبقيت خضراء بينما صار كل شيء كحليًّا.
 *
 * والعطل من نوعٍ لا يكشفه اختبار وظيفي ولا مترجم: الصفحة تعمل، والزرّ
 * يُضغط، واللون وحده خاطئ. ولا يراه إلا من يفتح تلك الصفحة بعينها بعد
 * التغيير — وقد لا يفتحها أحد قبل العميل.
 *
 * فيمنع هذا الحارس عودتَه: كل لون يمرّ برمز، والرمز يُغيَّر في موضع واحد.
 */

const SOURCE_ROOT = join(process.cwd(), 'src');

/** ألوان Tailwind الجاهزة — استعمالها يلتفّ على اللوحة */
const HARDCODED = /\b(?:bg|text|border|ring|from|to|via|fill|stroke|decoration|outline|shadow|accent|caret|divide)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;

function sourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) found.push(...sourceFiles(path));
    else if (entry.endsWith('.tsx')) found.push(path);
  }
  return found;
}

describe('لوحة الألوان تمرّ برموز النظام', () => {
  it('توجد ملفات أصلًا — وإلا فالحارس يحرس فراغًا', () => {
    expect(sourceFiles(SOURCE_ROOT).length).toBeGreaterThan(50);
  });

  it('لا لون Tailwind جاهز مكتوب مباشرةً في أي مكوّن', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SOURCE_ROOT)) {
      const matches = readFileSync(file, 'utf8').match(HARDCODED);
      if (matches) {
        offenders.push(`${file.replace(process.cwd(), '')} → ${[...new Set(matches)].join(', ')}`);
      }
    }

    expect(
      offenders,
      'اللون المكتوب مباشرةً لا يتغيّر مع اللوحة، فيبقى وحده على اللون القديم',
    ).toEqual([]);
  });
});

describe('الرموز معرَّفة في الوضعين', () => {
  const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
  const light = css.slice(css.indexOf(':root'), css.indexOf('.dark'));
  const dark = css.slice(css.indexOf('.dark'));

  const REQUIRED = [
    '--background', '--foreground', '--primary', '--primary-foreground',
    '--secondary', '--muted', '--accent', '--accent-foreground',
    '--destructive', '--success', '--warning', '--gold', '--gold-foreground',
    '--gold-soft', '--border', '--input', '--ring',
  ];

  it('كل رمز معرَّف في الوضع الفاتح', () => {
    for (const token of REQUIRED) expect(light, token).toContain(`${token}:`);
  });

  it('كل رمز معرَّف في الوضع الداكن — والناقص يرث لونًا لا يُرى', () => {
    for (const token of REQUIRED) expect(dark, token).toContain(`${token}:`);
  });
});

describe('الذهبيّ لا يلتبس بالتحذير', () => {
  const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

  /** يقرأ درجة اللون من `--token: H S% L%` */
  function hue(token: string, from: number): number {
    const match = css.slice(from).match(new RegExp(`${token}:\\s*(\\d+)\\s`));
    if (!match) throw new Error(`لم يُعثر على ${token}`);
    return Number(match[1]);
  }

  it('بينهما مسافة كافية في الدرجة اللونية', () => {
    // الذهبيّ الفاقع يُقرأ إنذارًا، فيتعلّم المستخدم تجاهل التحذيرات
    const start = css.indexOf(':root');
    expect(Math.abs(hue('--gold', start) - hue('--warning', start))).toBeGreaterThanOrEqual(10);
  });
});
