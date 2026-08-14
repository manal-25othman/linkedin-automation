import type { Metadata } from 'next';
import { ResetPasswordForm } from './form';

export const metadata: Metadata = {
  title: 'تعيين كلمة مرور جديدة',
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <div className="w-full max-w-md">
      <h1 className="text-2xl font-bold">تعيين كلمة مرور جديدة</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        اختر كلمة مرور قوية لا تستعملها في موقع آخر.
      </p>

      <div className="mt-8">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
