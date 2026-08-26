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
import { Badge } from '@/components/ui/badge';
import { Section, SectionHeading } from '@/components/marketing/sections';
import { Reveal } from '@/components/marketing/reveal';
import { Pulse } from '@/components/marketing/pulse';
import { DemoConsole } from '@/components/marketing/demo-console';
import { FeatureShowcase } from '@/components/marketing/feature-showcase';
import { Comparison } from '@/components/marketing/comparison';
import { PricingTable } from '@/components/marketing/pricing-table';
import { FaqList } from '@/components/marketing/faq-list';
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
      <section className="relative overflow-hidden border-b bg-background">
        <div className="hero-halo pointer-events-none absolute inset-0" aria-hidden />
        <div className="tech-dots pointer-events-none absolute inset-0" aria-hidden />

        <div className="container relative py-20 sm:py-28">
          <div className="reveal-now mx-auto max-w-3xl text-center">
            {/* حبّة الإعلان: حدٌّ خافت وزجاجٌ خفيف بدل خلفية مصمتة —
                تجلس على الهالة ولا تقطعها. */}
            <Badge
              variant="outline"
              className="mb-6 gap-2 rounded-full border-border/70 bg-card/60 px-4 py-1.5 text-xs font-medium backdrop-blur"
            >
              <Pulse />
              {t('home.badge')}
            </Badge>

            {/*
             * ثلاث درجات لا درجتان.
             *
             * كان السطران بالمقاس نفسه، على افتراض أنهما عبارتان
             * قصيرتان. فلمّا كُتبا جملتين كاملتين ملآ شاشة الهاتف
             * سبعة أسطر، ولم يبقَ للبرهان ولا للزرّ موضع.
             *
             * فصار الأول عنوانًا والثاني سطرًا مساندًا أصغر منه
             * وملوّنًا، والثالث شرحًا رماديًّا. والعين تقرأ الترتيب
             * قبل أن تقرأ الكلمات.
             */}
            <h1
              className={cn(
                'text-balance font-semibold tracking-tight',
                // المقاس يتبع الطول: عنوانٌ طويل بمقاس القصير يبتلع
                // الشاشة، وقصيرٌ بمقاس الطويل يبدو باهتًا
                heroLine1.length > 55
                  ? 'text-[1.35rem] leading-[1.45] sm:text-3xl sm:leading-[1.3]'
                  : 'text-[1.6rem] leading-[1.35] sm:text-4xl sm:leading-[1.25]',
              )}
            >
              {heroLine1}
            </h1>

            {heroLine2 ? (
              <p
                className={cn(
                  'mx-auto mt-4 max-w-2xl text-balance font-medium leading-relaxed text-primary',
                  heroLine2.length > 55 ? 'text-base sm:text-lg' : 'text-lg sm:text-xl',
                )}
              >
                {heroLine2}
              </p>
            ) : null}

            <p className="mx-auto mt-5 max-w-2xl text-pretty text-[0.95rem] leading-loose text-muted-foreground sm:text-base">
              {t('home.hero.subtitle')}
            </p>

            {/* الزرّان حبّتان مستديرتان: الأول متوهّج والثاني محدّد فقط.
                والفرق بينهما بصريّ لا لفظيّ — يُعرف الأهمّ قبل قراءته. */}
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                asChild
                className="glow-primary group h-12 rounded-full px-7 text-base font-semibold"
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
                className="h-12 rounded-full border-border/80 bg-card/50 px-7 text-base backdrop-blur"
              >
                <Link href="/contact">{t('home.cta.secondary')}</Link>
              </Button>
            </div>

            <p className="mt-5 text-sm text-muted-foreground">{t('home.cta.note')}</p>
          </div>

          {/* إطارٌ حول لوحة العرض: حلقةٌ خافتة ووهجٌ تحتها يرفعانها عن
              الأرض، فتُقرأ نافذةَ منتجٍ لا صندوقًا في الصفحة. */}
          <div
            className="reveal-now mx-auto mt-16 max-w-4xl rounded-2xl bg-card/40 p-1.5 ring-1 ring-border/70 backdrop-blur"
            style={{
              animationDelay: '120ms',
              boxShadow: '0 34px 96px -46px hsl(var(--primary) / 0.22)',
            }}
          >
            <DemoConsole />
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- المشكلة */}
      <Section>
        <Reveal>
          <SectionHeading
            eyebrow={t('home.problem.eyebrow')}
            title={t('home.problem.title')}
            description={t('home.problem.description')}
          />
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {t.list('home.problem.cards').map((item, index) => {
            const Icon = pickIcon(PROBLEM_ICONS, index);
            return (
              <Reveal key={`${item.title}-${index}`} delay={index * 110}>
                <article className="lift h-full rounded-xl border bg-card p-6">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-destructive/10">
                    <Icon className="size-5 text-destructive" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </article>
              </Reveal>
            );
          })}
        </div>
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
          <div className="mt-14">
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
      <Section>
        <Reveal>
          <SectionHeading eyebrow={t('home.steps.eyebrow')} title={t('home.steps.title')} />
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {t.list('home.steps.items').map((item, index) => (
            <Reveal key={`${item.title}-${index}`} delay={index * 100}>
              <div className="lift relative h-full rounded-xl border bg-card p-6">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {item.step}
                </span>
                <h3 className="mt-4 text-base font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* --------------------------------------------------------- الأمان */}
      <Section muted>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <SectionHeading
              align="start"
              eyebrow={t('home.security.eyebrow')}
              title={t('home.security.title')}
              description={t('home.security.description')}
            />
            <div className="mt-8">
              <Button variant="outline" asChild>
                <Link href="/security">
                  {t('home.security.link')}
                  <ArrowLeft className="size-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2">
            {t.list('home.security.cards').map((item, index) => {
              const Icon = pickIcon(SECURITY_ICONS, index);
              return (
                <Reveal key={`${item.title}-${index}`} delay={index * 90}>
                  <div className="lift h-full rounded-xl border bg-card p-5">
                    <Icon className="size-5 text-primary" aria-hidden />
                    <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
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
      <Section>
        <Reveal>
          <SectionHeading
            eyebrow={t('home.platform.eyebrow')}
            title={t('home.platform.title')}
          />
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {t.list('home.platform.cards').map((item, index) => {
            const Icon = pickIcon(PLATFORM_ICONS, index);
            return (
              <Reveal key={`${item.title}-${index}`} delay={(index % 3) * 90}>
                <div className="lift h-full rounded-xl border bg-card p-6">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="size-5 text-primary" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Section>

      {/* --------------------------------------------------------- الأسعار */}
      <Section muted id="pricing">
        <Reveal>
          <SectionHeading
            eyebrow={t('home.pricing.eyebrow')}
            title={t('home.pricing.title')}
            description={t('home.pricing.description')}
          />
        </Reveal>
        <Reveal className="mt-14" delay={100}>
          <PricingTable />
        </Reveal>
      </Section>

      {/* --------------------------------------------------- أسئلة شائعة */}
      <Section>
        <Reveal>
          <SectionHeading eyebrow={t('home.faq.eyebrow')} title={t('home.faq.title')} />
        </Reveal>
        <Reveal className="mx-auto mt-12 max-w-3xl" delay={80}>
          <FaqList items={homeFaq(t)} />
        </Reveal>
      </Section>

      {/* ------------------------------------------------------ دعوة ختامية */}
      <section className="border-t bg-gradient-to-b from-background to-accent/40">
        <div className="container py-20 sm:py-24">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t('home.final.title')}
            </h2>
            <p className="mt-4 text-base leading-loose text-muted-foreground">
              {t('home.final.description')}
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
