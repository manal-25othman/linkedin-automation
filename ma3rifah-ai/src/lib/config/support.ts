/**
 * ثوابت الدعم الفني — بلا server-only.
 *
 * تُستعمل في مكوّنات العميل والخادم معًا، فلا يصحّ أن تسكن ملفًا يستورد
 * مفتاح الخدمة. فصل الثوابت عن المنطق يمنع أن يُسحب الخادم كله إلى
 * حزمة المتصفح بسبب سطر تسمية.
 */

export const TICKET_STATUS_LABELS: Record<string, string> = {
  OPEN: 'مفتوحة',
  IN_PROGRESS: 'قيد المعالجة',
  RESOLVED: 'محلولة',
  CLOSED: 'مغلقة',
};

export const TICKET_PRIORITY_LABELS: Record<string, string> = {
  LOW: 'منخفضة',
  NORMAL: 'عادية',
  HIGH: 'عالية',
  URGENT: 'عاجلة',
};

export const TICKET_CATEGORIES = [
  'مشكلة تقنية',
  'رفع المستندات',
  'جودة الإجابات',
  'المستخدمون والصلاحيات',
  'الفوترة والاشتراك',
  'طلب ميزة',
  'أخرى',
];
