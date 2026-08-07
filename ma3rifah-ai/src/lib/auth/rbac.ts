import type { UserRole } from '@/types/database';

/**
 * الصلاحيات — مصدر واحد للحقيقة على الخادم والواجهة.
 *
 * ملاحظة أمنية: هذا الملف يحدّد ما تعرضه الواجهة فقط.
 * التحقق الفعلي يتم دائمًا على الخادم (guards.ts) وفي RLS داخل قاعدة البيانات.
 */

export const PERMISSIONS = [
  'company.manage',
  'company.view_settings',
  'users.view',
  'users.manage',
  'departments.view',
  'departments.manage',
  'documents.view',
  'documents.manage',
  'categories.view',
  'categories.manage',
  'assistant.use',
  'conversations.view_own',
  'knowledge_gaps.view',
  'knowledge_gaps.manage',
  'analytics.view_company',
  'analytics.view_department',
  'audit.view',
  'billing.view',
  'platform.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const EMPLOYEE_PERMISSIONS: Permission[] = [
  'documents.view',
  'categories.view',
  'assistant.use',
  'conversations.view_own',
];

const MANAGER_PERMISSIONS: Permission[] = [
  ...EMPLOYEE_PERMISSIONS,
  'users.view',
  'departments.view',
  'knowledge_gaps.view',
  'analytics.view_department',
];

const COMPANY_ADMIN_PERMISSIONS: Permission[] = [
  ...MANAGER_PERMISSIONS,
  'company.manage',
  'company.view_settings',
  'users.manage',
  'departments.manage',
  'documents.manage',
  'categories.manage',
  'knowledge_gaps.manage',
  'analytics.view_company',
  'audit.view',
  'billing.view',
];

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  EMPLOYEE: EMPLOYEE_PERMISSIONS,
  MANAGER: MANAGER_PERMISSIONS,
  COMPANY_ADMIN: COMPANY_ADMIN_PERMISSIONS,
  SUPER_ADMIN: [...PERMISSIONS],
};

export function can(role: UserRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAny(role: UserRole | null | undefined, permissions: Permission[]): boolean {
  return permissions.some((permission) => can(role, permission));
}

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'مدير المنصة',
  COMPANY_ADMIN: 'مدير الشركة',
  MANAGER: 'مدير قسم',
  EMPLOYEE: 'موظف',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  SUPER_ADMIN: 'إدارة المنصة والشركات والاشتراكات.',
  COMPANY_ADMIN: 'إدارة كاملة للشركة: المستخدمون، المستندات، الإعدادات والتحليلات.',
  MANAGER: 'متابعة تحليلات قسمه والاطلاع على فجوات المعرفة.',
  EMPLOYEE: 'استخدام المساعد الذكي والبحث في المعرفة المسموح له بها.',
};

/** الأدوار التي يجوز لمدير الشركة إسنادها */
export const ASSIGNABLE_ROLES: UserRole[] = ['COMPANY_ADMIN', 'MANAGER', 'EMPLOYEE'];
