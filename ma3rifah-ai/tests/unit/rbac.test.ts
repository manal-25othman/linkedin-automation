import { describe, it, expect } from 'vitest';
import { can, canAny, ASSIGNABLE_ROLES, PERMISSIONS } from '@/lib/auth/rbac';
import { isUnansweredResponse, buildUserMessage, buildSystemPrompt } from '@/lib/ai/prompts';
import type { UserRole } from '@/types/database';

describe('صلاحيات الأدوار', () => {
  it('الموظف يستطيع استخدام المساعد ولا يستطيع إدارة المستندات', () => {
    expect(can('EMPLOYEE', 'assistant.use')).toBe(true);
    expect(can('EMPLOYEE', 'documents.view')).toBe(true);
    expect(can('EMPLOYEE', 'documents.manage')).toBe(false);
    expect(can('EMPLOYEE', 'users.manage')).toBe(false);
    expect(can('EMPLOYEE', 'knowledge_gaps.view')).toBe(false);
    expect(can('EMPLOYEE', 'audit.view')).toBe(false);
  });

  it('مدير القسم يرى فجوات المعرفة ولا يديرها', () => {
    expect(can('MANAGER', 'knowledge_gaps.view')).toBe(true);
    expect(can('MANAGER', 'knowledge_gaps.manage')).toBe(false);
    expect(can('MANAGER', 'analytics.view_department')).toBe(true);
    expect(can('MANAGER', 'users.view')).toBe(true);
    expect(can('MANAGER', 'users.manage')).toBe(false);
  });

  it('مدير الشركة يدير كل ما يخص شركته', () => {
    for (const permission of [
      'documents.manage',
      'users.manage',
      'departments.manage',
      'knowledge_gaps.manage',
      'analytics.view_company',
      'audit.view',
      'billing.view',
    ] as const) {
      expect(can('COMPANY_ADMIN', permission)).toBe(true);
    }
  });

  it('مدير الشركة لا يملك صلاحية إدارة المنصة', () => {
    expect(can('COMPANY_ADMIN', 'platform.manage')).toBe(false);
    expect(can('SUPER_ADMIN', 'platform.manage')).toBe(true);
  });

  it('مدير المنصة يملك كل الصلاحيات المعرّفة', () => {
    for (const permission of PERMISSIONS) {
      expect(can('SUPER_ADMIN', permission)).toBe(true);
    }
  });

  it('الأدوار ترث صلاحيات ما دونها', () => {
    const employeePermissions = PERMISSIONS.filter((permission) => can('EMPLOYEE', permission));
    for (const permission of employeePermissions) {
      expect(can('MANAGER', permission)).toBe(true);
      expect(can('COMPANY_ADMIN', permission)).toBe(true);
    }
  });

  it('الدور غير المعروف لا يملك أي صلاحية', () => {
    expect(can(null, 'assistant.use')).toBe(false);
    expect(can(undefined, 'documents.view')).toBe(false);
    expect(canAny(null, ['assistant.use', 'documents.view'])).toBe(false);
  });

  it('مدير الشركة لا يستطيع إسناد دور مدير المنصة', () => {
    expect(ASSIGNABLE_ROLES).not.toContain('SUPER_ADMIN' as UserRole);
  });
});

describe('كشف الإجابات غير المُجابة', () => {
  it('يتعرّف على الصيغة الرسمية', () => {
    expect(
      isUnansweredResponse(
        'لم أجد معلومات كافية في قاعدة معرفة الشركة للإجابة عن هذا السؤال.',
      ),
    ).toBe(true);
  });

  it('يتعرّف على صيغ عربية بديلة', () => {
    expect(isUnansweredResponse('للأسف لم أجد معلومات كافية حول هذا الموضوع.')).toBe(true);
    expect(isUnansweredResponse('لا توجد معلومات كافية في المصادر المتاحة.')).toBe(true);
  });

  it('يتعرّف على الصيغة الإنجليزية', () => {
    expect(
      isUnansweredResponse("I couldn't find enough information in the knowledge base."),
    ).toBe(true);
  });

  it('لا يصنّف إجابة صحيحة كغير مُجابة', () => {
    expect(
      isUnansweredResponse('رصيد الإجازة السنوية 21 يوم عمل، ويرتفع إلى 30 يومًا بعد خمس سنوات.'),
    ).toBe(false);
  });
});

describe('بناء الموجّه', () => {
  it('يمنع النموذج صراحةً من اختلاق السياسات', () => {
    const prompt = buildSystemPrompt({
      companyName: 'شركة الاختبار',
      tone: 'professional',
      userName: 'موظف',
      userRole: 'موظف',
      departmentName: null,
    });

    expect(prompt).toContain('لا تخترع سياسة');
    expect(prompt).toContain('لا تخترع رقمًا');
    expect(prompt).toContain('اعتمد حصريًا على المقاطع المسترجعة');
    expect(prompt).toContain('شركة الاختبار');
  });

  it('يوضّح غياب المصادر عند فراغ الاسترجاع', () => {
    const message = buildUserMessage('ما سياسة الإجازات؟', []);
    expect(message).toContain('لم تُسترجع أي مقاطع');
  });

  it('يرقّم المصادر ويذكر أرقام الصفحات', () => {
    const message = buildUserMessage('ما سياسة الإجازات؟', [
      {
        chunkId: 'c1',
        documentId: 'd1',
        documentName: 'سياسة الإجازات.pdf',
        content: 'رصيد الإجازة السنوية 21 يوم عمل.',
        pageNumber: 3,
        sectionTitle: 'الإجازة السنوية',
        similarity: 0.82,
      },
    ]);

    expect(message).toContain('[مصدر 1]');
    expect(message).toContain('سياسة الإجازات.pdf');
    expect(message).toContain('صفحة 3');
    expect(message).toContain('رصيد الإجازة السنوية 21 يوم عمل.');
  });
});
