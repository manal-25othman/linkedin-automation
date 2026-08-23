import { describe, expect, it } from 'vitest';
import { computeOnboarding, type WorkspaceState } from '../../src/lib/onboarding';

/**
 * رحلة التجهيز.
 *
 * ما يُختبر هنا ليس ترتيب الخطوات بل **صدق التقدّم**: أن يعكس ما في
 * قاعدة البيانات لا ما ضغطه المستخدم مرة. فمن رفع مستندًا ثم حذفه تعود
 * خطوته ناقصة — والعلامة المحفوظة تكذب هنا، والحساب من البيانات لا.
 *
 * وأهمّ حالة: من لا يملك صلاحية الإدارة. لو عُرضت له خطوة لا يستطيع
 * إنجازها لبقي تقدّمه عالقًا عند رقم لا يتحرّك مهما فعل.
 */

function state(over: Partial<WorkspaceState> = {}): WorkspaceState {
  return {
    usersCount: 1,
    documentsCount: 0,
    documentsReady: 0,
    questionsCount: 0,
    ...over,
  };
}

describe('حساب التقدّم', () => {
  it('الحساب الجديد يبدأ بخطوة منجزة لا بصفر', () => {
    // التقدّم من الصفر يُقرأ طريقًا طويلًا، ومن خطوةٍ يُقرأ طريقًا بدأ
    const progress = computeOnboarding(state());
    expect(progress.doneCount).toBe(1);
    expect(progress.percent).toBeGreaterThan(0);
    expect(progress.complete).toBe(false);
  });

  it('رفع مستند يُنجز خطوته', () => {
    expect(computeOnboarding(state({ documentsCount: 1 })).doneCount).toBe(2);
  });

  it('الفهرسة خطوة مستقلة عن الرفع', () => {
    // مستند مرفوع لم تكتمل معالجته لا يُسأل عنه — والخطوتان منفصلتان
    const uploaded = computeOnboarding(state({ documentsCount: 1 }));
    const indexed = computeOnboarding(state({ documentsCount: 1, documentsReady: 1 }));
    expect(indexed.doneCount).toBe(uploaded.doneCount + 1);
  });

  it('كل الخطوات تُنجز فتختفي البطاقة', () => {
    const progress = computeOnboarding(
      state({ usersCount: 2, documentsCount: 3, documentsReady: 3, questionsCount: 5 }),
    );
    expect(progress.complete).toBe(true);
    expect(progress.percent).toBe(100);
    expect(progress.next).toBeNull();
  });

  it('حذف المستند يُرجع الخطوة ناقصة', () => {
    // هذا ما تعجز عنه العلامة المحفوظة
    const before = computeOnboarding(state({ documentsCount: 1, documentsReady: 1 }));
    const after = computeOnboarding(state({ documentsCount: 0, documentsReady: 0 }));
    expect(after.doneCount).toBeLessThan(before.doneCount);
    expect(after.complete).toBe(false);
  });
});

describe('الخطوة التالية', () => {
  it('هي أول خطوة ناقصة', () => {
    expect(computeOnboarding(state()).next?.id).toBe('upload');
    expect(computeOnboarding(state({ documentsCount: 1 })).next?.id).toBe('indexed');
    expect(
      computeOnboarding(state({ documentsCount: 1, documentsReady: 1 })).next?.id,
    ).toBe('ask');
  });

  it('لكل خطوة ناقصة مسار ونداء فعل', () => {
    for (const step of computeOnboarding(state()).steps) {
      expect(step.href.startsWith('/')).toBe(true);
      expect(step.cta.trim()).not.toBe('');
    }
  });
});

describe('من لا يملك صلاحية الإدارة', () => {
  const employee = { canManage: false };

  it('لا يرى خطوة لا يستطيع إنجازها', () => {
    const progress = computeOnboarding(state(), employee);
    const ids = progress.steps.map((step) => step.id);
    expect(ids).not.toContain('upload');
    expect(ids).not.toContain('invite');
    expect(ids).toContain('ask');
  });

  it('يستطيع بلوغ 100٪ بما يملكه وحده', () => {
    // وإلا بقي تقدّمه عالقًا عند رقم لا يتحرّك مهما فعل
    const progress = computeOnboarding(state({ questionsCount: 1 }), employee);
    expect(progress.complete).toBe(true);
    expect(progress.percent).toBe(100);
  });

  it('تقدّمه محسوب على خطواته هو لا على خطوات المدير', () => {
    const employeeProgress = computeOnboarding(state(), employee);
    const adminProgress = computeOnboarding(state());
    expect(employeeProgress.totalCount).toBeLessThan(adminProgress.totalCount);
  });
});

describe('سلامة النسبة', () => {
  it('بين صفر ومئة في كل الحالات', () => {
    const combos: WorkspaceState[] = [];
    for (const users of [0, 1, 5]) {
      for (const docs of [0, 2]) {
        for (const ready of [0, 2]) {
          for (const questions of [0, 9]) {
            combos.push({
              usersCount: users,
              documentsCount: docs,
              documentsReady: ready,
              questionsCount: questions,
            });
          }
        }
      }
    }

    for (const combo of combos) {
      for (const canManage of [true, false]) {
        const progress = computeOnboarding(combo, { canManage });
        expect(progress.percent).toBeGreaterThanOrEqual(0);
        expect(progress.percent).toBeLessThanOrEqual(100);
        expect(progress.doneCount).toBeLessThanOrEqual(progress.totalCount);
        expect(progress.complete).toBe(progress.next === null);
      }
    }
  });
});
