import type { Plan } from '@/types/database';

/**
 * نسخة احتياطية من الخطط.
 *
 * مصدر الحقيقة هو جدول `plans` في قاعدة البيانات — هذه النسخة تُستخدم
 * فقط عندما يتعذّر الوصول إليها (وقت البناء، أو انقطاع مؤقت)، حتى لا
 * تظهر صفحة الأسعار فارغة. القيم هنا مطابقة لِـ 0005_billing_schema.sql.
 */
export const FALLBACK_PLANS: Plan[] = [
  {
    id: 'fallback-starter',
    code: 'STARTER',
    name: 'Starter',
    description: 'للفرق الصغيرة التي تبدأ رحلتها في إدارة المعرفة.',
    price_amount: 499,
    currency: 'SAR',
    billing_interval: 'MONTHLY',
    max_users: 50,
    max_documents: 100,
    max_questions_monthly: 5000,
    max_storage_mb: 5120,
    features: [
      'مساعد ذكي بالعربية والإنجليزية',
      'رفع المستندات ومعالجتها',
      'قاعدة معرفة وتصنيفات',
      'تحليلات أساسية',
      'دعم عبر البريد الإلكتروني',
    ],
    is_public: true,
    is_custom_priced: false,
    sort_order: 1,
    created_at: '',
    updated_at: '',
  },
  {
    id: 'fallback-business',
    code: 'BUSINESS',
    name: 'Business',
    description: 'للشركات النامية التي تحتاج تحكمًا وتحليلات أعمق.',
    price_amount: 999,
    currency: 'SAR',
    billing_interval: 'MONTHLY',
    max_users: 200,
    max_documents: 500,
    max_questions_monthly: 20000,
    max_storage_mb: 25600,
    features: [
      'كل مزايا Starter',
      'صلاحيات على مستوى الأقسام',
      'فجوات المعرفة والتوصيات',
      'تحليلات متقدمة',
      'سجل تدقيق كامل',
      'دعم ذو أولوية',
    ],
    is_public: true,
    is_custom_priced: false,
    sort_order: 2,
    created_at: '',
    updated_at: '',
  },
  {
    id: 'fallback-enterprise',
    code: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'للمؤسسات الكبيرة ذات المتطلبات الخاصة.',
    price_amount: null,
    currency: 'SAR',
    billing_interval: 'MONTHLY',
    max_users: null,
    max_documents: null,
    max_questions_monthly: null,
    max_storage_mb: null,
    features: [
      'كل مزايا Business',
      'عدد مستخدمين غير محدود',
      'تكاملات مخصصة',
      'اتفاقية مستوى خدمة (SLA)',
      'مدير حساب مخصص',
      'خيارات استضافة خاصة',
    ],
    is_public: true,
    is_custom_priced: true,
    sort_order: 3,
    created_at: '',
    updated_at: '',
  },
];

/** الخطة المُسندة تلقائيًا لشركة جديدة */
export const DEFAULT_PLAN_CODE = 'STARTER';

/** مدة الفترة التجريبية بالأيام */
export const TRIAL_PERIOD_DAYS = 14;

export function formatLimit(value: number | null, unit: string): string {
  if (value === null) return `${unit} بلا حدود`;
  return `${new Intl.NumberFormat('ar-SA').format(value)} ${unit}`;
}
