import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { QUICK_START_STEPS, quickStartFor } from '@/content/help';
import { can } from '@/lib/auth/rbac';
import type { UserRole } from '@/types/database';

/**
 * دليل الخطوات لا يجوز أن يعِد بما لا يملكه القارئ.
 *
 * الدليل المكتوب بالدور اسمًا يفترق عن الصلاحيات بأول تعديل عليها،
 * فيقول لمدير قسم «ارفعي مستندًا» وهو لا يرى الزرّ. فيظنّ العطل في
 * المنتج — والعطل في الدليل. وهذا أسوأ من نقص في الشرح: الشرح الناقص
 * يُسأل عنه، والشرح الكاذب يُصدَّق فيُهدر الوقت في البحث عن زرّ لا وجود
 * له.
 *
 * فالربط هنا بالمصدر نفسه (`can`)، وهذه الاختبارات تمنع فكّه.
 */

const ROLES: UserRole[] = ['EMPLOYEE', 'MANAGER', 'COMPANY_ADMIN', 'SUPER_ADMIN'];

/**
 * الحارس الحقيقي: صلاحية الخطوة تُقارَن بحارس الصفحة التي تقصدها.
 *
 * والمقارنة ليست بالتساوي. صفحة المستندات تحرسها `documents.view`
 * ويملكها الموظف — لكن **زرّ الرفع** يحتاج `documents.manage`. فخطوة
 * «ارفعي مستندًا» صلاحيتها أقوى من صلاحية الصفحة عن قصد.
 *
 * فالشرط أن تكون صلاحية الخطوة **مستلزِمة** لحارس الصفحة: كل من مرّت
 * عليه الخطوة يمرّ من الحارس. ولو انعكست النسبة لظهرت الخطوة لمن
 * ترتدّ به الصفحة.
 *
 * وقراءةُ الحارس من ملف الصفحة لا من جدول مكتوب هنا: الجدول يُنسى
 * تحديثه، والملف هو ما يُشغَّل.
 */
describe('صلاحية الخطوة تستلزم حارس صفحتها', () => {
  const guardOf = (href: string): string | null => {
    const path = join(process.cwd(), `src/app/(dashboard)${href}/page.tsx`);
    if (!existsSync(path)) return null;
    const match = readFileSync(path, 'utf8').match(/requirePermission\('([a-z_.]+)'\)/);
    return match ? match[1] : null;
  };

  it('كل وجهة موجودة فعلًا — لا رابط إلى صفحة محذوفة', () => {
    for (const step of QUICK_START_STEPS) {
      const path = join(process.cwd(), `src/app/(dashboard)${step.href}/page.tsx`);
      expect(existsSync(path), `${step.href} لا وجود لها`).toBe(true);
    }
  });

  it.each(QUICK_START_STEPS.map((step) => [step.title, step] as const))(
    '«%s» لا تظهر لمن ترتدّ به وجهتها',
    (_title, step) => {
      const guard = guardOf(step.href);
      if (!guard || !step.permission) return;

      for (const role of ROLES) {
        if (!can(role, step.permission)) continue;
        expect(can(role, guard as Parameters<typeof can>[1]), `${role}: ${step.href}`).toBe(true);
      }
    },
  );
});

describe('كل دور يجد ما يبدأ به', () => {
  it.each(ROLES)('%s يرى خطوة واحدة على الأقل', (role) => {
    expect(quickStartFor(role).length).toBeGreaterThan(0);
  });

  it('الموظف يبدأ بالسؤال لا بالرفع — فهو لا يرفع', () => {
    const steps = quickStartFor('EMPLOYEE');
    expect(steps[0].href).toBe('/assistant');
    expect(steps.some((step) => step.href === '/documents')).toBe(false);
  });

  it('مدير القسم يرى الفجوات ولا يرى الرفع', () => {
    const steps = quickStartFor('MANAGER');
    expect(steps.some((step) => step.href === '/knowledge-gaps')).toBe(true);
    expect(steps.some((step) => step.href === '/documents')).toBe(false);
  });

  it('مدير الشركة يبدأ بالرفع وينتهي بالدعوة', () => {
    const steps = quickStartFor('COMPANY_ADMIN');
    expect(steps[0].href).toBe('/documents');
    expect(steps[steps.length - 1].href).toBe('/users');
  });
});

describe('صياغة الخطوات', () => {
  it('لكل خطوة عنوان وتفصيل ووجهة ونصّ زرّ', () => {
    for (const step of QUICK_START_STEPS) {
      expect(step.title.length).toBeGreaterThan(3);
      expect(step.detail.length).toBeGreaterThan(20);
      expect(step.href.startsWith('/')).toBe(true);
      expect(step.cta.length).toBeGreaterThan(2);
    }
  });

  it('لا وجهة مكرّرة بنصّ زرّ واحد — كل خطوة تُميَّز', () => {
    const titles = QUICK_START_STEPS.map((step) => step.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('الترتيب صالح لكل دور بعد الترشيح — لا فجوة في التسلسل', () => {
    // الترشيح يحذف ولا يعيد ترتيبًا، فترتيب أي دور جزءٌ من الترتيب العام
    for (const role of ROLES) {
      const filtered = quickStartFor(role).map((step) => step.title);
      const positions = filtered.map((title) =>
        QUICK_START_STEPS.findIndex((step) => step.title === title),
      );
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    }
  });
});
