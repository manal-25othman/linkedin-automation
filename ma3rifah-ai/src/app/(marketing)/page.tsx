import Link from 'next/link';
import {
  ArrowLeft,
  BrainCircuit,
  Building2,
  ClipboardCheck,
  Clock,
  FileWarning,
  Languages,
  Lock,
  MessagesSquare,
  Repeat2,
  ShieldCheck,
  Sparkles,
  UserMinus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Section, SectionHeading } from '@/components/marketing/sections';
import { Reveal } from '@/components/marketing/reveal';
import { Pulse } from '@/components/marketing/pulse';
import { DemoConsole } from '@/components/marketing/demo-console';
import { FeatureShowcase } from '@/components/marketing/feature-showcase';
import { Comparison } from '@/components/marketing/comparison';
import { SecurityFlow } from '@/components/marketing/security-flow';
import { PricingTable } from '@/components/marketing/pricing-table';
import { FaqList } from '@/components/marketing/faq-list';
import { SpotlightGroup, TiltCard } from '@/components/marketing/motion';
import { QuestionRibbon, SplitWords } from '@/components/marketing/ribbon';
import { getSiteText } from '@/lib/content/site-text';
import { homeFaq } from '@/lib/content/faq';
import { pickIcon } from '@/components/marketing/icon-cycle';
import { cn } from '@/lib/utils';

/**
 * الصفحة الرئيسية.
 *
 * قاعدة الصياغة هنا: لا جملة تصلح لمنافس. «منصة ذكاء معرفي تساعد فرقك»
 * يقولها الجميع فلا تُقنع أحدًا. كل قسم أدناه يقول شيئًا واحدًا محدّدًا
 * يستطيع الزائر التحقق منه أو رؤيته بعينه.
 *
 * وليس في الصفحة شهادة عميل ولا شعار شركة ولا إحصاءة سوق — لا عملاء بعد،
 * واختلاق ذلك يُكتشف في أول اجتماع ويُفقد الصفقة كلها.
 *
 * والنصوص كلها تُقرأ من سجلّ المحتوى لا من هذا الملف: ما تكتبه صاحبة
 * المنتج في اللوحة يظهر هنا مباشرةً. وما بقي في الشيفرة هو الأيقونات
 * والتخطيط وحدهما.
 *
 * الهوية البصرية: صدرٌ بعمودين — الوعد يمينًا والمنتج يعمل يسارًا —
 * وسديمٌ لونيّ خلفه، وبطاقات زجاجية، وحلقة متدرّجة حول ما يُرفع.
 * الجرأة في موضع واحد (الصدر والدعوة الختامية) وما بينهما هادئ.
 */

const PROBLEM_ICONS = [Repeat2, Clock, UserMinus];
const SECURITY_ICONS = [Building2, Lock, ClipboardCheck, BrainCircuit];
const PLATFORM_ICONS = [
  MessagesSquare,
  Sparkles,
  FileWarning,
  ShieldCheck,
  Languages,
  Lock,
];

export default async function HomePage() {
  const t = await getSiteText();
  const heroLine1 = t('home.hero.line1');
  const heroLine2 = t('home.hero.line2');

  return (
    <>
      {/* ------------------------------------------------------------ Hero */}
      <section className="relative overflow-hidden">
        <div className="mk-mesh pointer-events-none absolute inset-0" aria-hidden />
        <div className="mk-blob mk-blob-a" aria-hidden />
        <div className="mk-blob mk-blob-b" aria-hidden />
        <div className="mk-blob mk-blob-c" aria-hidden />
        <div className="tech-grid pointer-events-none absolute inset-0" aria-hidden />

        <div className="container relative pb-16 pt-12 sm:pb-24 sm:pt-16 lg:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
            <div className="reveal-now text-center lg:text-start">
              <p className="flex justify-center lg:justify-start">
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-card/70 px-4 py-1.5 text-xs font-bold text-primary backdrop-blur">
                  <Pulse />
                  {t('home.badge')}
                </span>
              </p>

              {/*
               * ثلاث درجات: عنوانٌ كبير، وسطرٌ مساند بتدرّج لونيّ يحمل
               * الوعد، وشرحٌ رماديّ. والعين تقرأ الترتيب قبل الكلمات.
               */}
              <h1
                className={cn(
                  'mt-6 text-balance font-extrabold tracking-tight',
                  heroLine1.length > 55
                    ? 'text-3xl leading-[1.3] sm:text-4xl lg:text-[2.9rem] lg:leading-[1.22]'
                    : 'text-4xl leading-[1.22] sm:text-5xl lg:text-[3.5rem] lg:leading-[1.15]',
                )}
              >
                <SplitWords text={heroLine1} baseDelay={80} />
              </h1>

              {heroLine2 ? (
                <p
                  className={cn(
                    'mk-gradient-text mx-auto mt-4 max-w-2xl text-balance font-extrabold leading-snug lg:mx-0',
                    heroLine2.length > 55 ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl',
                  )}
                >
                  {heroLine2}
                </p>
              ) : null}

              <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-loose text-muted-foreground sm:text-lg lg:mx-0">
                {t('home.hero.subtitle')}
              </p>

              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
                <Button
                  size="lg"
                  asChild
                  className="mk-cta group h-12 rounded-full border-0 px-8 text-base font-bold"
                >
                  <Link href="/register">
                    {t('home.cta.primary')}
                    <ArrowLeft
                      className="size-4 transition-transform group-hover:-translate-x-1"
                      aria-hidden
                    />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="h-12 rounded-full border-border/80 bg-card/60 px-8 text-base backdrop-blur"
                >
                  <Link href="/contact">{t('home.cta.secondary')}</Link>
                </Button>
              </div>

              <p className="mt-5 text-sm text-muted-foreground">{t('home.cta.note')}</p>
            </div>

            {/* المنتج يعمل: حلقةٌ متدرّجة ووهجٌ تحته وطفوٌ بطيء، فيُقرأ
                نافذةَ منتجٍ حيّ لا صورةً في الصفحة. */}
            <div className="reveal-now relative" style={{ animationDelay: '140ms' }}>
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] opacity-70 blur-3xl"
                style={{
                  background:
                    'radial-gradient(60% 60% at 50% 40%, hsl(var(--primary) / 0.35), transparent 70%)',
                }}
              />
              <div className="mk-float">
                <TiltCard className="mk-ring mk-ring-live rounded-[1.75rem] bg-card/50 p-2 backdrop-blur">
                  <DemoConsole />
                </TiltCard>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* شريط الأسئلة: ما يُسأل فعلًا، يمرّ أمام الزائر قبل أن يقرأ المشكلة */}
      <QuestionRibbon />

      {/* --------------------------------------------------------- المشكلة */}
      <Section>
        <Reveal>
          <SectionHeading
            eyebrow={t('home.problem.eyebrow')}
            title={t('home.problem.title')}
            description={t('home.problem.description')}
          />
        </Reveal>

        <SpotlightGroup className="mt-16 grid gap-5 md:grid-cols-3">
          {t.list('home.problem.cards').map((item, index) => {
            const Icon = pickIcon(PROBLEM_ICONS, index);
            return (
              <Reveal key={`${item.title}-${index}`} delay={index * 110}>
                <article className="mk-card lift h-full p-7">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-gold/10 text-gold">
                    <Icon className="size-6" aria-hidden />
                  </div>
                  <h3 className="mt-5 text-lg font-bold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-loose text-muted-foreground">
                    {item.description}
                  </p>
                </article>
              </Reveal>
            );
          })}
        </SpotlightGroup>
      </Section>

      {/* ------------------------------------------------------ ما يميّزنا */}
      <Section muted>
        <Reveal>
          <SectionHeading
            eyebrow={t('home.diff.eyebrow')}
            title={t('home.diff.title')}
            description={t('home.diff.description')}
          />
        </Reveal>

        <Reveal>
          <div className="mt-16">
            <FeatureShowcase
              items={t.list('home.diff.cards').map((item) => ({
                badge: item.badge,
                title: item.title,
                description: item.description,
              }))}
            />
          </div>
        </Reveal>
      </Section>

      {/* -------------------------------------------------------- المقارنة */}
      <Section>
        <Reveal>
          <SectionHeading
            eyebrow={t('home.compare.eyebrow')}
            title={t('home.compare.title')}
            description={t('home.compare.description')}
          />
        </Reveal>

        <Reveal>
          <Comparison
            rows={t.list('home.compare.rows').map((row) => ({
              aspect: row.aspect,
              generic: row.generic,
              ours: row.ours,
            }))}
          />
        </Reveal>
      </Section>

      {/* ------------------------------------------------------- كيف تعمل */}
      <Section muted>
        <Reveal>
          <SectionHeading eyebrow={t('home.steps.eyebrow')} title={t('home.steps.title')} />
        </Reveal>

        <Reveal className="relative mt-16">
          {/* خطّ يُرسم من اليمين إلى اليسار حين يظهر القسم: الترتيب حركةٌ لا رقمٌ فقط */}
          <div
            className="mk-draw pointer-events-none absolute inset-x-10 top-[3.4rem] hidden h-px lg:block"
            style={{
              backgroundImage:
                'linear-gradient(90deg, hsl(var(--glow-b) / 0.6), hsl(var(--primary) / 0.6))',
            }}
            aria-hidden
          />
        <SpotlightGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {t.list('home.steps.items').map((item, index) => (
            <Reveal key={`${item.title}-${index}`} delay={index * 100}>
              <div className="mk-card lift relative h-full overflow-hidden p-7">
                {/* الرقم كبيرٌ بتدرّج: هو الترتيب، والترتيب هنا معنًى */}
                <span className="mk-step-number block" aria-hidden>
                  {item.step}
                </span>
                <h3 className="mt-4 text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-loose text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </Reveal>
          ))}
        </SpotlightGroup>
        </Reveal>
      </Section>

      {/* --------------------------------------------------------- الأمان */}
      <Section>
        <div className="mk-panel relative overflow-hidden rounded-[2rem] px-6 py-12 sm:px-12 sm:py-16">
          <div className="mk-mesh pointer-events-none absolute inset-0" aria-hidden />
          <div className="tech-dots pointer-events-none absolute inset-0 opacity-60" aria-hidden />

          <div className="relative grid items-center gap-12 lg:grid-cols-2">
            <Reveal>
              <SectionHeading
                align="start"
                eyebrow={t('home.security.eyebrow')}
                title={t('home.security.title')}
                description={t('home.security.description')}
              />
              <div className="mt-8">
                <Button variant="outline" asChild className="rounded-full bg-card/40">
                  <Link href="/security">
                    {t('home.security.link')}
                    <ArrowLeft className="size-4" aria-hidden />
                  </Link>
                </Button>
              </div>
            </Reveal>

            <div>
              <SecurityFlow
                stages={t.list('home.security.flow').map((item) => ({
                  stage: item.stage,
                  detail: item.detail,
                }))}
              />
            </div>
          </div>

          <div className="relative mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {t.list('home.security.cards').map((item, index) => {
              const Icon = pickIcon(SECURITY_ICONS, index);
              return (
                <Reveal key={`${item.title}-${index}`} delay={index * 90}>
                  <div className="lift h-full rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur">
                    <Icon className="size-5 text-primary" aria-hidden />
                    <h3 className="mt-3 text-sm font-bold">{item.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </Section>

      {/* -------------------------------------------------------- المميزات */}
      <Section muted>
        <Reveal>
          <SectionHeading
            eyebrow={t('home.platform.eyebrow')}
            title={t('home.platform.title')}
          />
        </Reveal>

        {/* شبكة «بينتو»: البطاقة الأولى أعرض لأنها المساعد نفسه — الميزة
            التي تُشترى، والبقية تخدمها. */}
        <SpotlightGroup className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {t.list('home.platform.cards').map((item, index) => {
            const Icon = pickIcon(PLATFORM_ICONS, index);
            const lead = index === 0;
            return (
              <Reveal
                key={`${item.title}-${index}`}
                delay={(index % 3) * 90}
                className={cn(lead && 'md:col-span-2')}
              >
                <div
                  className={cn(
                    'mk-card lift relative h-full overflow-hidden p-7',
                    lead && 'mk-ring mk-ring-live sm:p-9',
                  )}
                >
                  {lead ? (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -end-16 -top-16 size-56 rounded-full opacity-60 blur-3xl"
                      style={{ background: 'hsl(var(--primary) / 0.28)' }}
                    />
                  ) : null}
                  <div className={cn('mk-icon', lead ? 'size-14' : 'size-11')}>
                    <Icon className={lead ? 'size-7' : 'size-5'} aria-hidden />
                  </div>
                  <h3 className={cn('mt-5 font-bold', lead ? 'text-2xl' : 'text-lg')}>
                    {item.title}
                  </h3>
                  <p
                    className={cn(
                      'mt-2 leading-loose text-muted-foreground',
                      lead ? 'max-w-xl text-base' : 'text-sm',
                    )}
                  >
                    {item.description}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </SpotlightGroup>
      </Section>

      {/* --------------------------------------------------------- الأسعار */}
      <Section id="pricing">
        <Reveal>
          <SectionHeading
            eyebrow={t('home.pricing.eyebrow')}
            title={t('home.pricing.title')}
            description={t('home.pricing.description')}
          />
        </Reveal>
        <Reveal className="mt-16" delay={100}>
          <PricingTable />
        </Reveal>
      </Section>

      {/* --------------------------------------------------- أسئلة شائعة */}
      <Section muted>
        <Reveal>
          <SectionHeading eyebrow={t('home.faq.eyebrow')} title={t('home.faq.title')} />
        </Reveal>
        <Reveal className="mx-auto mt-14 max-w-3xl" delay={80}>
          <FaqList items={homeFaq(t)} />
        </Reveal>
      </Section>

      {/* ------------------------------------------------------ دعوة ختامية */}
      <Section>
        <Reveal>
          <div className="mk-panel relative overflow-hidden rounded-[2rem] px-6 py-16 text-center sm:px-12 sm:py-24">
            <div className="mk-mesh pointer-events-none absolute inset-0" aria-hidden />
            <div className="mk-blob mk-blob-a" aria-hidden />
            <div className="mk-blob mk-blob-b" aria-hidden />
            <div className="tech-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="mk-gradient-text text-balance text-3xl font-extrabold leading-[1.25] sm:text-4xl lg:text-5xl">
                {t('home.final.title')}
              </h2>
              <p className="mt-5 text-base leading-loose text-muted-foreground sm:text-lg">
                {t('home.final.description')}
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  size="lg"
                  asChild
                  className="mk-cta group h-12 rounded-full border-0 px-8 text-base font-bold"
                >
                  <Link href="/register">
                    {t('home.cta.primary')}
                    <ArrowLeft
                      className="size-4 transition-transform group-hover:-translate-x-1"
                      aria-hidden
                    />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="h-12 rounded-full bg-card/40 px-8 text-base"
                >
                  <Link href="/contact">{t('home.final.secondary')}</Link>
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </Section>
    </>
  );
}
