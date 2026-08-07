/** الأقسام الافتراضية التي تُنشأ مع كل شركة جديدة */
export const DEFAULT_DEPARTMENTS = [
  { name: 'الموارد البشرية', code: 'HR', description: 'شؤون الموظفين والتوظيف والرواتب.' },
  { name: 'المالية', code: 'FIN', description: 'الميزانيات والمصروفات والتقارير المالية.' },
  { name: 'العمليات', code: 'OPS', description: 'التشغيل اليومي وسلاسل الإمداد.' },
  { name: 'تقنية المعلومات', code: 'IT', description: 'الأنظمة والدعم التقني والأمن السيبراني.' },
  { name: 'الإدارة', code: 'MGMT', description: 'الإدارة التنفيذية والتخطيط الاستراتيجي.' },
  { name: 'أخرى', code: 'OTHER', description: 'أقسام أخرى غير مصنّفة.' },
] as const;

/** تصنيفات المعرفة الافتراضية */
export const DEFAULT_CATEGORIES = [
  {
    name: 'الموارد البشرية',
    description: 'سياسات التوظيف والإجازات والرواتب وشؤون الموظفين.',
    color: '#0f766e',
    sort_order: 1,
  },
  {
    name: 'المالية',
    description: 'السياسات المالية وإجراءات الصرف والمشتريات.',
    color: '#1d4ed8',
    sort_order: 2,
  },
  {
    name: 'العمليات',
    description: 'أدلة التشغيل وإجراءات العمل اليومية.',
    color: '#b45309',
    sort_order: 3,
  },
  {
    name: 'تقنية المعلومات',
    description: 'سياسات الأنظمة والأجهزة وأمن المعلومات.',
    color: '#6d28d9',
    sort_order: 4,
  },
  {
    name: 'السياسات العامة',
    description: 'السياسات الشاملة التي تخص جميع الموظفين.',
    color: '#0369a1',
    sort_order: 5,
  },
  {
    name: 'التدريب',
    description: 'مواد التدريب والتأهيل ودليل الموظفين الجدد.',
    color: '#be123c',
    sort_order: 6,
  },
] as const;
