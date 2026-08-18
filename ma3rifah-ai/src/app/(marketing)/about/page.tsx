import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowLeft,
  BadgeCheck,
  Languages,
  ScanSearch,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Section, SectionHeading, Prose } from '@/components/marketing/sections';
import { Reveal } from '@/components/marketing/reveal';
import { pickIcon } from '@/components/marketing/icon-cycle';
import { getSiteText } from '@/lib/content/site-text';

export const metadata: Metadata = {
  title: 'نبذة عنا',
  description:
    'من نحن ولماذا بنينا معرفة AI: منصة سعودية تحوّل مستندات الشركة إلى مساعد ذكي يجيب بالعربية ويذكر مصدره.',
};

/**
 * صفحة «نبذة عنا».
 *
 * قاعدة الصدق هنا أشدّ منها في أي صفحة: لا عدد عملاء، ولا سنة تأسيس
 * مخترَعة، ولا فريق وهمي، ولا جوائز. المشتري المؤسسي يتحقق، وأول
 * مبالغة تُكتشف تُسقط الصفقة كلها لا البند الذي كُذب فيه.
 *
 * وصار النصّ محرَّرًا من اللوحة، فالقاعدة تنتقل إلى من يحرّر: الصفحة
 * تعرض ما يُكتب فيها بلا تجميل، ولا شيء في الشيفرة يمنع كتابة ادّعاء.
 * حارسُها الوحيد أن من يكتبها يعرف أنها تُقرأ قبل التوقيع لا بعده.
 */

const PRINCIPLE_ICONS = [Languages, BadgeCheck, ShieldCheck, ScanSearch];

export default async function AboutPage() {
  const t = await getSiteText();

  return (
    <>
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-accent/40 to-background">
        <div className="tech-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="container relative py-16 sm:py-24">
          <div className="reveal-now mx-auto max-w-3xl text-center">
            <h1 className="text-balance text-3xl font-bold leading-[1.3] sm:text-4xl">
              {t('about.title')}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-loose text-muted-foreground sm:text-lg">
              {t('about.subtitle')}
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ لماذا بدأنا */}
      <Section>
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <SectionHeading
              align="start"
              eyebrow={t('about.why.eyebrow')}
              title={t('about.why.title')}
            />
          </Reveal>

          <Reveal delay={80}>
            <Prose
              text={t('about.why.body')}
              className="mt-8 space-y-5"
              paragraphClassName="text-base leading-loose text-muted-foreground"
            />
          </Reveal>
        </div>
      </Section>

      {/* --------------------------------------------------------- المبادئ */}
      <Section muted>
        <Reveal>
          <SectionHeading
            eyebrow={t('about.principles.eyebrow')}
            title={t('about.principles.title')}
            description={t('about.principles.description')}
          />
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {t.list('about.principles.items').map((item, index) => {
            const Icon = pickIcon(PRINCIPLE_ICONS, index);
            return (
              <Reveal key={`${item.title}-${index}`} delay={(index % 2) * 90}>
                <article className="lift h-full rounded-xl border bg-card p-6 sm:p-7">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="size-5 text-primary" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-base font-bold">{item.title}</h3>
                  <p className="mt-2.5 text-sm leading-loose text-muted-foreground">
                    {item.body}
                  </p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </Section>

      {/* ------------------------------------------------------- لمن نبنيها */}
      <Section>
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <Reveal>
            <SectionHeading
              align="start"
              eyebrow={t('about.audience.eyebrow')}
              title={t('about.audience.title')}
              description={t('about.audience.description')}
            />
            <ul className="mt-8 space-y-3">
              {t.list('about.audience.items').map((item, index) => (
                <li
                  key={`${item.label}-${index}`}
                  className="flex items-start gap-3 text-sm leading-relaxed"
                >
                  <span
                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                    aria-hidden
                  />
                  {item.label}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={90}>
            <div className="rounded-2xl border bg-card p-6 sm:p-8">
              <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10">
                <Target className="size-5 text-primary" aria-hidden />
              </div>
              <h3 className="mt-4 text-lg font-bold">{t('about.promise.title')}</h3>
              <Prose
                text={t('about.promise.body')}
                className="mt-3 space-y-3"
                paragraphClassName="text-sm leading-loose text-muted-foreground"
              />
            </div>
          </Reveal>
        </div>
      </Section>

      {/* ------------------------------------------------------ دعوة ختامية */}
      <section className="border-t bg-gradient-to-b from-background to-accent/40">
        <div className="container py-16 sm:py-20">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">{t('about.cta.title')}</h2>
            <p className="mt-4 text-base leading-loose text-muted-foreground">
              {t('about.cta.description')}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild className="group">
                <Link href="/register">
                  {t('home.cta.primary')}
                  <ArrowLeft
                    className="size-4 transition-transform group-hover:-translate-x-1"
                    aria-hidden
                  />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/contact">{t('home.final.secondary')}</Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
