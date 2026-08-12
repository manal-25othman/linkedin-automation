import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { RegisterForm } from './register-form';
import { markVisitorConverted } from '@/lib/ai/site-chat';

export const metadata: Metadata = {
  title: 'إنشاء حساب',
  description: 'أنشئ حساب شركتك في منصة معرفة AI وابدأ ببناء قاعدة معرفة ذكية.',
  robots: { index: false, follow: false },
};

/**
 * الصفحة ديناميكية لأنها تقرأ كوكي الزائر لتسجيل التحوّل: كم زائرًا
 * تحدّث إلى مساعد الموقع ثم وصل فعلًا إلى صفحة التسجيل. لا يُقرأ من
 * الكوكي إلا معرّف عشوائي بلا أي بيانات شخصية.
 */
export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const visitorKey = (await cookies()).get('ma3rifah_visitor')?.value;
  if (visitorKey) await markVisitorConverted(visitorKey);

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
