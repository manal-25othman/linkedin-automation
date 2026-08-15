/** ترجمة أسماء الأحداث إلى عبارات عربية صالحة للعرض */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'auth.register': 'إنشاء حساب شركة',
  'auth.login': 'تسجيل دخول',
  'company.updated': 'تحديث بيانات الشركة',
  'company.ai_settings_updated': 'تحديث إعدادات المساعد',
  'plan.created': 'إضافة خطة',
  'plan.updated': 'تعديل خطة',
  'user.invited': 'دعوة مستخدم',
  'user.created': 'إضافة مستخدم',
  'user.updated': 'تحديث بيانات مستخدم',
  'user.role_changed': 'تغيير دور مستخدم',
  'user.deactivated': 'تعطيل مستخدم',
  'user.reactivated': 'إعادة تفعيل مستخدم',
  'user.access_link_resent': 'إعادة إرسال رابط الدخول',
  'department.created': 'إضافة قسم',
  'department.updated': 'تعديل قسم',
  'department.deleted': 'حذف قسم',
  'category.created': 'إضافة تصنيف',
  'category.updated': 'تعديل تصنيف',
  'category.deleted': 'حذف تصنيف',
  'document.uploaded': 'رفع مستند',
  'document.processed': 'اكتمال معالجة مستند',
  'document.processing_failed': 'فشل معالجة مستند',
  'document.updated': 'تعديل مستند',
  'document.deleted': 'حذف مستند',
  'document.permissions_changed': 'تغيير صلاحيات مستند',
  'knowledge_gap.status_changed': 'تغيير حالة فجوة معرفة',
  'knowledge_gap.resolved': 'معالجة فجوة معرفة',
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}
