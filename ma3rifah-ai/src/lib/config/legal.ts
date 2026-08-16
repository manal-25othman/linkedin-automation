/**
 * بيانات الكيان القانوني.
 *
 * تُترك فارغة عمدًا حتى تُملأ ببيانات حقيقية. الصفحات القانونية تعرض
 * تنبيهًا ظاهرًا ما دامت ناقصة، ولا تختلق اسمًا ولا رقم سجلّ ولا رقمًا
 * ضريبيًا — فمستند قانوني يحمل بيانات مخترعة أسوأ من غيابه: يبدو ملزِمًا
 * وهو باطل، ويعرّض صاحبه للمساءلة بدل أن يحميه.
 *
 * تُضبط عبر متغيرات البيئة، وتُقرأ بمراجع صريحة لأن Next تستبدل
 * NEXT_PUBLIC_ وقت البناء.
 */

export const LEGAL_ENTITY = {
  /** الاسم النظامي الكامل كما في السجل التجاري */
  name: process.env.NEXT_PUBLIC_LEGAL_NAME?.trim() || '',
  /** رقم السجل التجاري */
  registrationNumber: process.env.NEXT_PUBLIC_LEGAL_CR?.trim() || '',
  /** الرقم الضريبي (ضريبة القيمة المضافة) */
  vatNumber: process.env.NEXT_PUBLIC_LEGAL_VAT?.trim() || '',
  /** العنوان الوطني */
  address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS?.trim() || '',
  /** بريد التواصل النظامي */
  email: process.env.NEXT_PUBLIC_LEGAL_EMAIL?.trim() || '',
} as const;

export const IS_LEGAL_ENTITY_COMPLETE =
  LEGAL_ENTITY.name !== '' && LEGAL_ENTITY.registrationNumber !== '' && LEGAL_ENTITY.email !== '';

/** تاريخ آخر تحديث للوثيقتين — يُحدَّث يدويًا عند أي تعديل جوهري */
export const LEGAL_LAST_UPDATED = '2026-08-16';

/** المعالِجون الفرعيون — إفصاح مطلوب في أي سياسة خصوصية جادّة */
export const SUBPROCESSORS = [
  {
    name: 'Supabase',
    purpose: 'استضافة قاعدة البيانات، المصادقة، وتخزين الملفات',
    region: 'يُحدَّد عند إنشاء المشروع',
  },
  {
    name: 'Anthropic',
    purpose: 'توليد إجابات المساعد الذكي من المقاطع المسترجَعة',
    region: 'الولايات المتحدة',
  },
  {
    name: 'Vercel',
    purpose: 'استضافة التطبيق وتوصيله',
    region: 'شبكة عالمية',
  },
  {
    name: 'Resend',
    purpose: 'إرسال رسائل البريد التشغيلية (الدعوات واستعادة كلمة المرور)',
    region: 'الولايات المتحدة',
  },
  {
    name: 'Moyasar',
    purpose: 'معالجة المدفوعات',
    region: 'المملكة العربية السعودية',
  },
] as const;
