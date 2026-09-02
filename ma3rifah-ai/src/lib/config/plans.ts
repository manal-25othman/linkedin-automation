import type { Plan } from '@/types/database';

/**
 * نسخة احتياطية من الخطط.
 *
 * مصدر الحقيقة هو جدول `plans` في قاعدة البيانات — هذه النسخة تُستخدم
 * فقط عندما يتعذّر الوصول إليها (وقت البناء، أو انقطاع مؤقت)، حتى لا
 * تظهر صفحة الأسعار فارغة. القيم هنا مطابقة لِـ 0005_billing_schema.sql.
 */
/**
 * نسخة احتياطية من الخطط — مطابقة للترحيلة 0025 و0029.
 *
 * كانت عالقة على أسعار ما قبل إعادة التسعير (٤٩٩ و٩٩٩) وحدودها، بلا
 * خطة Growth. فلو تعذّرت القاعدة لحظةَ بناءٍ أو انقطاع، لعُرضت على
 * الزائر **الأسعار التي كانت تخسر** — وهي المشكلة التي عولجت في 0025.
 *
 * والتكرار يتعفّن بطبعه، فيحرسه اختبار يقرأ الترحيلة نصًّا ويقارن.
 */
export const FALLBACK_PLANS: Plan[] = [
  {
    id: 'fallback-starter',
    code: 'STARTER',
    name: 'Starter',
    description: 'للفرق الصغيرة التي تبدأ رحلتها في إدارة المعرفة.',
    price_amount: 899,
    currency: 'SAR',
    billing_interval: 'MONTHLY',
    max_users: 10,
    max_documents: 50,
    max_questions_monthly: 600,
    max_storage_mb: 5120,
    max_ocr_pages_monthly: 150,
    features: [
      'المساعد الذكي على مستنداتكم',
      'المصدر والصفحة مع كل إجابة',
      'التحقق من الأرقام',
      'الأقسام والصلاحيات',
      'سجل تدقيق',
    ],
    is_public: true,
    is_custom_priced: false,
    sort_order: 1,
    created_at: '',
    updated_at: '',
  },
  {
    id: 'fallback-growth',
    code: 'GROWTH',
    name: 'Growth',
    description: 'للشركات النامية التي تحتاج تحليلات أعمق وتكاملات.',
    price_amount: 2499,
    currency: 'SAR',
    billing_interval: 'MONTHLY',
    max_users: 30,
    max_documents: 200,
    max_questions_monthly: 2000,
    max_storage_mb: 25600,
    max_ocr_pages_monthly: 600,
    features: [
      'كل مزايا Starter',
      'تحليلات متقدمة',
      'فجوات المعرفة',
      'واتساب',
      'دعم ذو أولوية',
    ],
    is_public: true,
    is_custom_priced: false,
    sort_order: 2,
    created_at: '',
    updated_at: '',
  },
  {
    id: 'fallback-business',
    code: 'BUSINESS',
    name: 'Business',
    description: 'للشركات التي تحتاج تحكمًا وامتثالًا أوسع.',
    price_amount: 5999,
    currency: 'SAR',
    billing_interval: 'MONTHLY',
    max_users: 75,
    max_documents: 600,
    max_questions_monthly: 6000,
    max_storage_mb: 102400,
    max_ocr_pages_monthly: 2000,
    features: [
      'كل مزايا Growth',
      'الدخول الموحّد (SSO)',
      'تقرير عزل موقّع',
      'اتفاقية مستوى خدمة ٩٩٫٥٪',
      'مدير حساب مخصص',
    ],
    is_public: true,
    is_custom_priced: false,
    sort_order: 3,
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
    max_ocr_pages_monthly: null,
    features: [
      'كل مزايا Business',
      'عدد مستخدمين غير محدود',
      'مفتاح العميل (BYOK)',
      'تكاملات مخصصة',
      'خيارات استضافة خاصة',
    ],
    is_public: true,
    is_custom_priced: true,
    sort_order: 4,
    created_at: '',
    updated_at: '',
  },
];

/**
 * الخطة المُسندة تلقائيًا لشركة جديدة.
 *
 * كانت `STARTER` — أي أن المجرِّب يأخذ حدود الخطة المدفوعة كاملة:
 * خمسين مستندًا وستمئة سؤال. والتجربة السخيّة لا تبيع: من يكفيه
 * المجّاني لا يشتري، والحدّ الذي لا يُبلَغ أبدًا لا يصنع قرارًا.
 */
export const DEFAULT_PLAN_CODE = 'TRIAL';

/**
 * مدة الفترة التجريبية بالأيام.
 *
 * سبعة لا أربعة عشر: القرار يُتخذ في الأسبوع الأول أو لا يُتخذ،
 * والأسبوع الثاني إطالةُ تردّد لا تقييمٌ إضافي. ومدةٌ أقصر تُبقي
 * الإلحاح قائمًا وتقصّر دورة البيع.
 *
 * **يُقرأ هذا الثابت في كل موضع** — والرقم المكرَّر في مكوّن عرض
 * يتعفّن بصمت فيُظهر شريط تقدّم لا يبلغ نهايته أبدًا.
 */
export const TRIAL_PERIOD_DAYS = 7;

export function formatLimit(value: number | null, unit: string): string {
  if (value === null) return `${unit} بلا حدود`;
  return `${new Intl.NumberFormat('ar-SA').format(value)} ${unit}`;
}
