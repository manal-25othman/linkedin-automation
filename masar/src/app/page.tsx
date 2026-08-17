import { AlertTriangle, FileText, Route } from 'lucide-react';
import { CareerAgent } from '@/components/career-agent';
import { isAiConfigured } from '@/lib/env';

export default function HomePage() {
  const configured = isAiConfigured();

  return (
    <main className="container max-w-4xl py-10">
      <header className="mb-10 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground">
          <Route className="size-4" />
          مسار
        </div>
        <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">
          من رابط الوظيفة إلى سيرة تُقنع
        </h1>
        <p className="mx-auto mt-4 max-w-2xl leading-8 text-muted-foreground">
          الصق رابط الإعلان: يقرأه الوكيل ويعطيك نصائح التقديم والملخص المهني الجاهز. ثم ارفع
          سيرتك ليحلّلها مقابل الوظيفة، ويعيد كتابتها، ويكتب رسالة التقديم — مع مقارنة قبل/بعد
          وملف Word جاهز.
        </p>
      </header>

      {!configured && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
          <div className="text-sm leading-7">
            <p className="font-semibold">الوكيل غير مُهيّأ بعد</p>
            <p className="text-muted-foreground">
              انسخ <code className="font-mono text-xs">.env.example</code> إلى{' '}
              <code className="font-mono text-xs">.env.local</code> وضع فيه مفتاح{' '}
              <code className="font-mono text-xs">ANTHROPIC_API_KEY</code>، ثم أعد تشغيل الخادم.
            </p>
          </div>
        </div>
      )}

      <CareerAgent />

      <footer className="mt-12 border-t border-border pt-6 text-center text-xs leading-6 text-muted-foreground">
        <p className="flex items-center justify-center gap-2">
          <FileText className="size-3.5" />
          لا تُحفظ سيرتك ولا نصّ الوظيفة في أي قاعدة بيانات — تُعالَج في الذاكرة ثم تُهمل.
        </p>
        <p className="mt-2">
          راجع كل ما يكتبه الوكيل قبل إرساله. مسؤوليتك أن يكون كل ما في سيرتك صحيحًا.
        </p>
      </footer>
    </main>
  );
}
