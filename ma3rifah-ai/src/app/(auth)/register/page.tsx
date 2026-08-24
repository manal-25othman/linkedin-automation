import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { RegisterForm } from './register-form';
import { markVisitorConverted } from '@/lib/ai/site-chat';
import { inviteRequired } from '@/lib/auth/invite';

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

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const visitorKey = (await cookies()).get('ma3rifah_visitor')?.value;
  if (visitorKey) await markVisitorConverted(visitorKey);

  // الرمز يُملأ من الرابط تسهيلًا فقط — والتحقّق منه على الخادم في
  // `registerAction`، فرابطٌ بلا رمز صحيح لا يفتح شيئًا.
  const { code } = await searchParams;
  const needsInvite = inviteRequired();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">أنشئ حساب شركتك</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {needsInvite
          ? 'التسجيل بدعوة في هذه المرحلة. ستصبحين مديرة الشركة، ويمكنك دعوة فريقك بعدها.'
          : 'ستصبح مدير الشركة، ويمكنك دعوة فريقك بعد ذلك مباشرة.'}
      </p>

      <div className="mt-8">
        <RegisterForm inviteRequired={needsInvite} presetCode={code} />
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
