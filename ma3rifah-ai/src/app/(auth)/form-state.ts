/**
 * حالة نماذج المصادقة.
 *
 * منفصلة عن actions.ts لأن ملف 'use server' لا يجوز أن يُصدّر إلا دوالًا
 * غير متزامنة — تصدير ثابت منه يفشل البناء.
 */
export interface AuthFormState {
  status: 'idle' | 'error' | 'pending_confirmation';
  message: string;
}

export const AUTH_INITIAL_STATE: AuthFormState = { status: 'idle', message: '' };
