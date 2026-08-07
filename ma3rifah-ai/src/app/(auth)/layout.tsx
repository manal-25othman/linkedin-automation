import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Logo } from '@/components/shared/brand';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* عمود النموذج */}
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            العودة للموقع
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>

      {/* عمود المحتوى التسويقي */}
      <div className="hidden border-s bg-muted/30 lg:flex lg:flex-col lg:justify-center lg:px-14">
        <div className="max-w-md">
          <h2 className="text-2xl font-semibold leading-snug tracking-tight">
            حوّل معرفة شركتك إلى ذكاء يعمل معك.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            بدل أن يبحث موظفوك في مجلدات مشتركة أو ينتظروا ردًا من زميل، يسألون المساعد
            ويحصلون على إجابة من مستندات الشركة — مع ذكر المصدر ورقم الصفحة.
          </p>

          <ul className="mt-10 space-y-5">
            {[
              {
                title: 'إجابات موثقة بالمصدر',
                body: 'كل إجابة تعرض المستند ورقم الصفحة، فيمكن التحقق منها فورًا.',
              },
              {
                title: 'لا يخترع سياسات',
                body: 'عندما لا تكفي المصادر يقول ذلك صراحة، ويُسجَّل السؤال كفجوة معرفة.',
              },
              {
                title: 'عزل كامل للبيانات',
                body: 'بيانات كل شركة معزولة في قاعدة البيانات نفسها، لا في كود التطبيق فقط.',
              },
            ].map((item) => (
              <li key={item.title} className="border-s-2 border-primary/30 ps-4">
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
