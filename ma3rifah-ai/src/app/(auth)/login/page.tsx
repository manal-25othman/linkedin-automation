import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'تسجيل الدخول',
  description: 'سجّل الدخول إلى حساب شركتك في منصة معرفة AI.',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">تسجيل الدخول</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        أدخل بيانات حسابك للوصول إلى مساعد المعرفة.
      </p>

      <div className="mt-8">
        <Suspense fallback={<div className="h-72" />}>
          <LoginForm />
        </Suspense>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        ليس لديك حساب؟{' '}
        <Link href="/register" className="font-medium text-primary hover:underline">
          أنشئ حساب شركتك
        </Link>
      </p>
    </div>
  );
}
