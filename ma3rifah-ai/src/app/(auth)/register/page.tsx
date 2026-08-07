import type { Metadata } from 'next';
import Link from 'next/link';
import { RegisterForm } from './register-form';

export const metadata: Metadata = {
  title: 'إنشاء حساب',
  description: 'أنشئ حساب شركتك في منصة معرفة AI وابدأ ببناء قاعدة معرفة ذكية.',
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">أنشئ حساب شركتك</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        ستصبح مدير الشركة، ويمكنك دعوة فريقك بعد ذلك مباشرة.
      </p>

      <div className="mt-8">
        <RegisterForm />
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        لديك حساب بالفعل؟{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          سجّل الدخول
        </Link>
      </p>
    </div>
  );
}
