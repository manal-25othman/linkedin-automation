import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/shared/brand';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Logo />
      <p className="mt-10 text-sm font-medium text-primary">خطأ 404</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
        الصفحة غير موجودة
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        الرابط الذي فتحته غير صحيح، أو أن العنصر المطلوب حُذف أو لم تعد لديك صلاحية الوصول إليه.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/dashboard">الذهاب إلى لوحة التحكم</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">العودة للصفحة الرئيسية</Link>
        </Button>
      </div>
    </div>
  );
}
