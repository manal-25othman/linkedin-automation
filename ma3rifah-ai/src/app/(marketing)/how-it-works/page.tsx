import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Section, PageHero, Prose } from '@/components/marketing/sections';
import { Reveal } from '@/components/marketing/reveal';
import { getSiteText } from '@/lib/content/site-text';
import { toLines } from '@/lib/content/group';

export const metadata: Metadata = {
  title: 'كيف يعمل',
  description:
    'من رفع المستند إلى الإجابة الموثقة: شرح خطوة بخطوة لكيفية تحويل مستندات شركتك إلى قاعدة معرفة ذكية باستخدام تقنية RAG.',
};

/** أرقام عربية-هندية للخطوات — تُشتق من الترتيب لا تُكتب في المحتوى */
const NUMERALS = ['١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export default async function HowItWorksPage() {
  const t = await getSiteText();
  const steps = t.list('how.steps');

  return (
    <>
      <PageHero
        eyebrow={t('how.eyebrow')}
        title={t('how.title')}
        description={t('how.description')}
      />

      <Section className="pt-0">
        <div className="mx-auto max-w-4xl">
          {steps.map((step, index) => (
            <Reveal
              key={`${step.title}-${index}`}
              className="relative flex gap-6 pb-12 last:pb-0 sm:gap-8"
            >
              {/* الخط الواصل بين الخطوات */}
              {index < steps.length - 1 ? (
                <div
                  aria-hidden
                  className="absolute top-12 h-[calc(100%-3rem)] w-px bg-border"
                  style={{ insetInlineStart: '1.375rem' }}
                />
              ) : null}

              <div className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
                {NUMERALS[index] ?? String(index + 1)}
              </div>

              <div className="min-w-0 flex-1 pt-1">
                <h3 className="text-lg font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
                <ul className="mt-4 space-y-2">
                  {toLines(step.points).map((point) => (
                    <li key={point} className="flex items-start gap-2.5">
                      <CheckCircle2
                        className="mt-0.5 size-4 shrink-0 text-primary"
                        aria-hidden
                      />
                      <span className="text-sm text-muted-foreground">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section muted>
        <div className="mx-auto max-w-3xl rounded-xl border bg-card p-8">
          <h2 className="text-lg font-semibold">{t('how.why.title')}</h2>
          <Prose
            text={t('how.why.body')}
            className="mt-4 space-y-4"
            paragraphClassName="text-sm leading-relaxed text-muted-foreground"
          />
        </div>
      </Section>

      <Section>
        <div className="text-center">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {t('how.cta.title')}
          </h2>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/register">
                ابدأ التجربة
                <ArrowLeft className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/contact">اطلب عرضًا للشركات</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
