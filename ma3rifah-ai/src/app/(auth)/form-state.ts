/**
 * حالة نماذج المصادقة.
 *
 * منفصلة عن actions.ts لأن ملف 'use server' لا يجوز أن يُصدّر إلا دوالًا
 * غير متزامنة — تصدير ثابت منه يفشل البناء.
 */
export interface AuthFormState {
  status: 'idle' | 'error' | 'pending_confirmation' | 'success';
  message: string;
  /**
   * ما كتبه المستخدم — يُعاد مع الخطأ فتبقى الحقول معبّأة.
   *
   * useActionState يعيد تركيب النموذج بعد كل إرسال، فخطأٌ في كلمة
   * المرور كان يمسح الاسم والشركة والبريد ويُرجع صاحبها للسطر الأول.
   * أول ملاحظة وصلت من مجرّب حقيقي — وكلمة المرور وحدها لا تُعاد أبدًا.
   */
  values?: Partial<
    Record<'fullName' | 'companyName' | 'jobTitle' | 'email' | 'inviteCode', string>
  >;
}

export const AUTH_INITIAL_STATE: AuthFormState = { status: 'idle', message: '' };
