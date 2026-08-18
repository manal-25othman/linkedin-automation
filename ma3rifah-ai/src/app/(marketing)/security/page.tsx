import type { Metadata } from 'next';
import Link from 'next/link';
import {
  DatabaseZap,
  FileKey,
  KeyRound,
  Layers,
  Lock,
  ScrollText,
  ServerCog,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Section, PageHero, FeatureCard, Prose } from '@/components/marketing/sections';
import { Reveal } from '@/components/marketing/reveal';
import { pickIcon } from '@/components/marketing/icon-cycle';
import { getSiteText } from '@/lib/content/site-text';

export const metadata: Metadata = {
  title: 'الأمان والخصوصية',
  description:
    'عزل كامل بين الشركات عبر Row Level Security، صلاحيات على مستوى المستند، تشفير البيانات، وسجل تدقيق شامل. تعرّف على كيفية حماية معرفة AI لبيانات مؤسستك.',
};

const CONTROL_ICONS = [
  Layers,
  Lock,
  UserCheck,
  ServerCog,
  KeyRound,
  FileKey,
  ScrollText,
  DatabaseZap,
  ShieldCheck,
];

export default async function SecurityPage() {
  const t = await getSiteText();

  return (
    <>
      <PageHero
        eyebrow={t('security.eyebrow')}
        title={t('security.title')}
        description={t('security.description')}
      />

      <Section className="pt-0">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {t.list('security.controls').map((control, index) => (
            <Reveal key={`${control.title}-${index}`} delay={(index % 3) * 80}>
              <FeatureCard
                icon={pickIcon(CONTROL_ICONS, index)}
                title={control.title ?? ''}
                description={control.description ?? ''}
              />
            </Reveal>
          ))}
        </div>
      </Section>

      <Section muted>
        <div className="mx-auto max-w-3xl">
          <h2 className="text-xl font-semibold tracking-tight">
            {t('security.leakage.title')}
          </h2>

          <div className="mt-8 space-y-6">
            {t.list('security.leakage.items').map((item, index) => (
              <div key={`${item.title}-${index}`} className="rounded-xl border bg-card p-6">
                <h3 className="text-base font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl rounded-xl border bg-card p-8">
          <h2 className="text-lg font-semibold">{t('security.training.title')}</h2>
          <Prose
            text={t('security.training.body')}
            className="mt-4 space-y-4"
            paragraphClassName="text-sm leading-relaxed text-muted-foreground"
          />
        </div>
      </Section>

      <Section muted>
        <div className="text-center">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {t('security.cta.title')}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {t('security.cta.description')}
          </p>
          <Button className="mt-7" asChild>
            <Link href="/contact">تواصل مع فريقنا</Link>
          </Button>
        </div>
      </Section>
    </>
  );
}
