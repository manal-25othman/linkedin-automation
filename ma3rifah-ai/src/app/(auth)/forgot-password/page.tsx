import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from './form';

export const metadata: Metadata = {
  title: 'استعادة كلمة المرور',
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-md">
      <h1 className="text-2xl font-bold">استعادة كلمة المرور</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        أدخل بريدك الإلكتروني وسنرسل لك رابطًا لتعيين كلمة مرور جديدة.
      </p>

      <div className="mt-8">
        <ForgotPasswordForm />
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        تذكّرتها؟{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          العودة لتسجيل الدخول
        </Link>
      </p>
    </div>
  );
}
