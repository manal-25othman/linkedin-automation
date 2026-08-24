import type { Metadata } from 'next';
import Link from 'next/link';
import { checkConfiguration } from '@/lib/env';
import { probeSupabase } from '@/lib/health/probe';
import { isAiConfigured } from '@/lib/ai/claude';
import { getEmbeddingProvider } from '@/lib/rag/embeddings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'حالة التجهيز',
  robots: { index: false, follow: false },
};

/**
 * صفحة تجهيز مقروءة بالعربية.
 *
 * تعرض ما يعرضه /api/health نفسه — لا معلومة زائدة — لكن بصياغة تقول
 * للقارئ ما العمل بدل أن تتركه يفسّر JSON. لا تُعرض هنا أي قيمة سرية:
 * الرابط العام وحده يظهر، وهو مشحون أصلًا إلى كل متصفح.
 */

type Check = {
  label: string;
  ok: boolean;
  detail?: string;
  fix?: React.ReactNode;
};

function StatusRow({ check }: { check: Check }) {
  return (
    <li className="border-b border-border py-5 last:border-0">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
            check.ok ? 'bg-[hsl(var(--success))]' : 'bg-destructive'
          }`}
        >
          {check.ok ? '✓' : '!'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">
            {check.label}
            <span className="sr-only">{check.ok ? ' — سليم' : ' — يحتاج إصلاحًا'}</span>
          </p>
          {check.detail ? (
            <p className="mt-1 break-words text-sm text-muted-foreground">{check.detail}</p>
          ) : null}
          {!check.ok && check.fix ? (
            <div className="mt-3 rounded-lg bg-[hsl(var(--warning))]/10 p-4 text-sm leading-7 text-[hsl(var(--warning))]">
              <p className="mb-2 font-semibold">ما العمل</p>
              {check.fix}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-primary underline underline-offset-4"
    >
      {children}
    </a>
  );
}

export default async function SetupPage() {
  const configuration = checkConfiguration();
  const supabase = await probeSupabase();

  let embeddings = 'غير متاح';
  let embeddingsReady = false;
  try {
    const provider = getEmbeddingProvider();
    embeddings = `${provider.name} — ${provider.model}`;
    embeddingsReady = provider.isProduction;
  } catch {
    embeddings = 'غير متاح';
  }

  const urlLooksRight = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(supabase.url);

  // عنوان المنصة: منه تُبنى كل روابط البريد. القيمة الافتراضية محلية،
  // فتصل الرسالة برابط لا يفتح إلا على جهاز المطوّر — عطل يبدو للمستخدم
  // كأن البريد لم يصل أصلًا.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const appUrlLooksRight = /^https:\/\/[^\s/]+$/.test(appUrl);

  const checks: Check[] = [
    {
      label: 'متغيّرات البيئة في Vercel',
      ok: configuration.missing.length === 0,
      detail:
        configuration.missing.length === 0
          ? 'كل المتغيّرات المطلوبة موجودة.'
          : `ناقص: ${configuration.missing.join('، ')}`,
      fix: (
        <>
          افتحي <Ext href="https://vercel.com/dashboard">Vercel</Ext> ← مشروعك ← Settings ←
          Environment Variables، وأضيفي المتغيّرات الناقصة المذكورة أعلاه على البيئات الثلاث، ثم
          Deployments ← ⋯ ← Redeploy.
        </>
      ),
    },
    {
      label: 'رابط مشروع Supabase',
      ok: urlLooksRight,
      detail: supabase.url ? `الرابط المستعمل: ${supabase.url}` : 'الرابط غير مضبوط.',
      fix: (
        <>
          الشكل الصحيح <code className="rounded bg-white px-1">https://xxxx.supabase.co</code> بلا
          أي شيء بعده.
          <br />
          انسخي <b>Project URL</b> من{' '}
          <Ext href="https://supabase.com/dashboard/project/_/settings/api">
            إعدادات API في Supabase
          </Ext>
          ، وضعيها في متغيّر <code className="rounded bg-white px-1">NEXT_PUBLIC_SUPABASE_URL</code>{' '}
          في Vercel، ثم أعيدي النشر.
        </>
      ),
    },
    {
      label: 'الاتصال بقاعدة البيانات',
      ok: supabase.rest === 'ok',
      detail:
        {
          ok: 'الجداول موجودة والمفتاح صالح.',
          invalid_key: 'المفتاح العام مرفوض — غالبًا من مشروع Supabase آخر.',
          schema_missing: 'الاستعلام رجع «غير موجود» — إمّا الرابط خاطئ أو الهجرات لم تُطبَّق.',
          not_found: 'المسار غير موجود على هذا الرابط.',
          unreachable: 'تعذّر الوصول إلى الخادم.',
          unexpected_status: 'رد غير متوقّع من الخادم.',
          unconfigured: 'الإعدادات ناقصة.',
        }[supabase.rest] +
        (supabase.restStatusCode !== null ? ` (رمز الرد: ${supabase.restStatusCode})` : ''),
      fix: (
        <>
          أصلحي أولًا بند «رابط مشروع Supabase» أعلاه — فأغلب حالات هذا الخطأ سببها الرابط لا
          قاعدة البيانات.
          <br />
          فإن كان الرابط سليمًا، فالهجرات لم تُطبَّق على هذا المشروع: افتحي{' '}
          <Ext href="https://supabase.com/dashboard/project/_/sql/new">محرّر SQL</Ext> والصقي محتوى
          الملف <code className="rounded bg-white px-1">supabase/ALL_MIGRATIONS.sql</code> ثم شغّليه.
        </>
      ),
    },
    {
      label: 'خدمة تسجيل الدخول',
      ok: supabase.auth === 'ok',
      detail: {
        ok: 'تعمل.',
        invalid_key: 'المفتاح العام مرفوض.',
        not_found: 'غير موجودة على هذا الرابط — دليل قاطع على أن الرابط لا يشير إلى مشروعك.',
        unreachable: 'تعذّر الوصول.',
        unexpected_status: 'رد غير متوقّع.',
        unconfigured: 'الإعدادات ناقصة.',
      }[supabase.auth],
      fix: (
        <>
          خدمة تسجيل الدخول موجودة في كل مشروع Supabase بلا استثناء. فشلها هنا يعني أن الرابط أو
          المفتاح يخصّ مشروعًا آخر. راجعي بند «رابط مشروع Supabase» أعلاه.
        </>
      ),
    },
    {
      label: 'السماح بإنشاء حسابات جديدة',
      ok: supabase.signupEnabled === true,
      detail:
        supabase.signupEnabled === null
          ? 'غير معروف — لم يمكن قراءة الإعدادات.'
          : supabase.signupEnabled
            ? 'مسموح.'
            : 'ممنوع حاليًا، فلن ينجح أي تسجيل.',
      fix: (
        <>
          افتحي{' '}
          <Ext href="https://supabase.com/dashboard/project/_/auth/providers">
            إعدادات المصادقة
          </Ext>{' '}
          وفعّلي <b>Allow new users to sign up</b> ثم احفظي.
        </>
      ),
    },
    {
      label: 'عنوان المنصة (NEXT_PUBLIC_APP_URL)',
      ok: appUrlLooksRight,
      detail: appUrlLooksRight
        ? `الروابط المُرسَلة بالبريد ستشير إلى: ${appUrl}`
        : `القيمة الحالية: ${appUrl} — روابط استعادة كلمة المرور والدعوات ستشير إلى هذا العنوان.`,
      fix: (
        <>
          كل رابط يُرسَل بالبريد (استعادة كلمة المرور، دعوة موظف) يُبنى من هذا المتغيّر. إن كان
          خاطئًا فالرسالة تصل ورابطها لا يعمل — وهو عطل يبدو كأن البريد لم يصل.
          <br />
          أضيفي في Vercel:{' '}
          <code className="rounded bg-white px-1">NEXT_PUBLIC_APP_URL</code> بقيمة عنوان منصتك
          كاملًا (مثل <code className="rounded bg-white px-1">https://ma3rifah-ai.vercel.app</code>)
          بلا شرطة في آخره، ثم أعيدي النشر.
        </>
      ),
    },
    {
      label: 'إرسال البريد (SMTP مخصّص)',
      // لا يمكن فحصه آليًا: Supabase لا تكشف حالة SMTP عبر واجهة عامة.
      // يُعرض تذكيرًا دائمًا لأن أثره لا يظهر إلا حين يعجز موظف عن الدخول.
      ok: false,
      detail:
        'بلا مزوّد بريد: لا تصل دعوات الموظفين، ولا تعمل استعادة كلمة المرور. ' +
        'الحسابات تُنشأ بكلمة مرور مؤقتة كحلّ مؤقت.',
      fix: (
        <>
          أنشئي حسابًا في <Ext href="https://resend.com">Resend</Ext> (٣٠٠٠ رسالة شهريًا
          مجانًا)، ثم افتحي{' '}
          <Ext href="https://supabase.com/dashboard/project/_/settings/auth">
            إعدادات المصادقة في Supabase
          </Ext>{' '}
          ← <b>SMTP Settings</b> ← فعّلي <b>Custom SMTP</b> وأدخلي بيانات المزوّد.
          <br />
          هذه الخطوة تُصلح الدعوات واستعادة كلمة المرور معًا، ولا تحتاج أي تعديل في الكود.
        </>
      ),
    },
    {
      label: 'مفتاح Claude',
      ok: isAiConfigured(),
      detail: isAiConfigured() ? 'مضبوط.' : 'غير مضبوط — المساعد الذكي معطّل.',
      fix: (
        <>
          أضيفي <code className="rounded bg-white px-1">ANTHROPIC_API_KEY</code> في Vercel ثم أعيدي
          النشر.
        </>
      ),
    },
    {
      label: 'مزوّد التضمينات (البحث في المستندات)',
      ok: embeddingsReady,
      detail: embeddings,
      fix: (
        <>
          أضيفي <code className="rounded bg-white px-1">VOYAGE_API_KEY</code> واضبطي{' '}
          <code className="rounded bg-white px-1">EMBEDDINGS_PROVIDER=voyage</code> في Vercel ثم
          أعيدي النشر.
        </>
      ),
    },
  ];

  const failing = checks.filter((check) => !check.ok);
  const ready = failing.length === 0;

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-white px-5 py-10">
      <p className="text-sm text-muted-foreground">معرفة AI</p>
      <h1 className="mt-1 text-2xl font-bold text-foreground">حالة التجهيز</h1>

      <div
        className={`mt-6 rounded-xl p-5 ${
          ready ? 'bg-accent text-accent-foreground' : 'bg-destructive/10 text-destructive'
        }`}
      >
        {ready ? (
          <>
            <p className="text-lg font-bold">النظام جاهز ✅</p>
            <p className="mt-1 text-sm leading-7">
              كل الفحوص سليمة. ابدئي بإنشاء حساب شركتك، ثم ارفعي مستندًا وانتظري حتى تتحوّل حالته
              إلى <b>READY</b>، ثم اسأليه سؤالًا إجابته داخل الملف.
            </p>
            <Link
              href="/register"
              className="mt-4 inline-block rounded-lg bg-primary px-5 py-2.5 font-semibold text-white"
            >
              أنشئ حساب شركتك
            </Link>
          </>
        ) : (
          <>
            <p className="text-lg font-bold">
              يتبقّى {failing.length === 1 ? 'بند واحد' : `${failing.length} بنود`}
            </p>
            <p className="mt-1 text-sm leading-7">
              ابدئي بأول بند أحمر في القائمة — غالبًا يُصلح إصلاحُه ما تحته، لأن الأعطال هنا
              متسلسلة.
            </p>
          </>
        )}
      </div>

      <ol className="mt-4">
        {checks.map((check) => (
          <StatusRow key={check.label} check={check} />
        ))}
      </ol>

      <div className="mt-8 rounded-xl bg-muted p-5 text-sm leading-7 text-foreground">
        <p className="font-semibold text-foreground">بعد أي تعديل في Vercel</p>
        <p className="mt-1">
          لا يُطبَّق التغيير إلا بنشر جديد: Deployments ← ⋯ ← Redeploy. ثم حدّثي هذه الصفحة.
        </p>
        <p className="mt-4 font-semibold text-foreground">أين تجدين سبب أي خطأ آخر</p>
        <ul className="mt-1 list-inside list-disc">
          <li>
            <Ext href="https://vercel.com/dashboard">سجلات Vercel</Ext> — أخطاء الخادم
          </li>
          <li>
            <Ext href="https://supabase.com/dashboard/project/_/logs/auth-logs">
              سجلات المصادقة في Supabase
            </Ext>{' '}
            — أخطاء التسجيل والدخول
          </li>
        </ul>
      </div>

      <p className="mt-6 text-xs leading-6 text-muted-foreground">
        لا تعرض هذه الصفحة أي مفتاح سرّي. الرابط الظاهر أعلاه عام بطبيعته ويُرسل إلى متصفح كل زائر
        ضمن ملفات الواجهة.
      </p>
    </main>
  );
}
