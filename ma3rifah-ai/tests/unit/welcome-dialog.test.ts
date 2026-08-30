import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * إظهار دليل الاستخدام.
 *
 * كان الدليل خلف أيقونة «؟» في الشريط العلوي. ومن لا يعرف أن ثمّة
 * دليلًا لا يبحث عنه — فبقي مكتوبًا ولم يُقرأ.
 *
 * فأُضيف نداءان: اسمٌ مكتوب بجانب الأيقونة، ونافذة ترحيب تظهر **مرّة**
 * وتدلّ عليه.
 *
 * والخطر في النافذة أن تصير مزعجة: ما يظهر في كل زيارة يُدرَّب المستخدم
 * على إغلاقه قبل قراءته، فيصير وجوده وعدمه سواء. فشرطان يحكمانها.
 */

const DIALOG = readFileSync(
  join(process.cwd(), 'src/components/dashboard/welcome-dialog.tsx'),
  'utf8',
);
const PAGE = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/dashboard/page.tsx'),
  'utf8',
);
const TOPBAR = readFileSync(
  join(process.cwd(), 'src/components/dashboard/topbar.tsx'),
  'utf8',
);

describe('تظهر مرّة لا في كل زيارة', () => {
  it('الرفض يُحفَظ', () => {
    expect(DIALOG).toContain("localStorage.setItem(STORAGE_KEY");
    expect(DIALOG).toContain('localStorage.getItem(STORAGE_KEY)');
  });

  it('تُغلق بأي طريق — لا بالزرّ وحده', () => {
    // الإغلاق بمفتاح الهروب أو بالنقر خارجها يجب أن يحفظ أيضًا،
    // وإلا عادت في الزيارة التالية لمن ظنّ أنه أغلقها
    expect(DIALOG).toMatch(/onOpenChange=\{\(next\) => \(next \? setOpen\(true\) : close\(\)\)\}/);
  });

  it('لا تظهر لمن أتمّ التجهيز', () => {
    expect(PAGE).toMatch(/onboarding\.complete \? null : <WelcomeDialog/);
  });

  it('تخزينٌ ممنوع ⇒ لا تظهر، ولا تسقط', () => {
    // في التصفّح الخاص يرمي الوصول. والظهور حينها يعني نافذةً تعود
    // في كل زيارة بلا سبيل إلى إسكاتها
    expect(DIALOG).toMatch(/catch \{[\s\S]{0,220}return;/);
  });
});

describe('تدلّ على الدليل', () => {
  it('فيها زرّ يفتحه', () => {
    expect(DIALOG).toContain('href="/help"');
  });

  it('خطواتها من مصدر الدليل نفسه لا منسوخة', () => {
    expect(PAGE).toContain('quickStartFor(profile.role)');
    expect(DIALOG).toContain("from '@/content/help'");
  });
});

describe('الرابط في الشريط العلوي مكتوب لا أيقونة وحدها', () => {
  it('الاسم يظهر على الشاشات الواسعة', () => {
    expect(TOPBAR).toMatch(/hidden md:inline">الدليل</);
  });

  it('الأيقونة تبقى للشاشات الضيّقة', () => {
    expect(TOPBAR).toContain('<CircleHelp');
    expect(TOPBAR).toContain('title="دليل الاستخدام"');
  });
});
