import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BadgeCheck,
  BarChart3,
  Bell,
  Building2,
  CircleSlash,
  Gauge,
  PenLine,
  FileStack,
  FolderTree,
  Languages,
  Lock,
  MessagesSquare,
  Quote,
  ScrollText,
  Search,
  ShieldCheck,
  Target,
  Users,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Section, PageHero, FeatureCard } from '@/components/marketing/sections';
import { Reveal } from '@/components/marketing/reveal';
import { pickIcon } from '@/components/marketing/icon-cycle';
import { getSiteText } from '@/lib/content/site-text';
import { groupRows } from '@/lib/content/group';

export const metadata: Metadata = {
  title: 'المميزات',
  description:
    'مساعد ذكي مبني على مستنداتك، إدارة مستندات، صلاحيات دقيقة، فجوات المعرفة، وتحليلات استخدام — كل ما تحتاجه لتحويل معرفة شركتك إلى أصل قابل للاستخدام.',
};

/**
 * أيقونات البطاقات مرتّبة كما كانت مجموعةً مجموعة.
 *
 * وهي في مصفوفة واحدة مسطّحة لأن البطاقات صارت تُحرَّر: تُحذف بطاقة من
 * مجموعة وتُضاف أخرى في غيرها، فربطُ الأيقونة بموضعها داخل مجموعتها
 * يجعل ترتيب الأيقونات يقفز مع كل تعديل. والمسطّح يبقيها مستقرّة.
 */
const CARD_ICONS = [
  MessagesSquare,
  Quote,
  Languages,
  ScrollText,
  BadgeCheck,
  Gauge,
  Quote,
  CircleSlash,
  FileStack,
  FolderTree,
  Search,
  Workflow,
  Lock,
  Users,
  Building2,
  ShieldCheck,
  Target,
  PenLine,
  Bell,
  BarChart3,
];

export default async function FeaturesPage() {
  const t = await getSiteText();

  const groups = t.list('features.groups');
  const cards = t.list('features.cards');

  // ترتيب المجموعات من قائمة المجموعات، ووصفُ كلٍّ منها منها كذلك.
  // والبطاقة بمجموعة غير مذكورة تُنشئ مجموعتها في الآخر بلا وصف — أهون
  // من أن تختفي بطاقة كُتبت لأن حرفًا اختلف في اسم مجموعتها.
  const order = groups.map((group) => group.title ?? '');
  const describe = new Map(groups.map((group) => [group.title ?? '', group.description]));

  let position = 0;

  return (
    <>
      <PageHero
        eyebrow={t('features.eyebrow')}
        title={t('features.title')}
        description={t('features.description')}
      />

      {groupRows(cards, 'group', order).map((group, index) => (
        <Section key={group.key} muted={index % 2 === 1} className="py-14">
          <Reveal className="mb-10 max-w-2xl">
            <h2 className="text-xl font-bold sm:text-2xl">{group.key}</h2>
            {describe.get(group.key) ? (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {describe.get(group.key)}
              </p>
            ) : null}
          </Reveal>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {group.items.map((feature, slot) => {
              const Icon = pickIcon(CARD_ICONS, position++);
              return (
                <Reveal key={`${feature.title}-${slot}`} delay={(slot % 4) * 80}>
                  <FeatureCard
                    icon={Icon}
                    title={feature.title ?? ''}
                    description={feature.description ?? ''}
                  />
                </Reveal>
              );
            })}
          </div>
        </Section>
      ))}

      <Section>
        <Reveal className="rounded-xl border bg-card p-10 text-center">
          <h2 className="text-xl font-bold sm:text-2xl">{t('features.cta.title')}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {t('features.cta.description')}
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/register">ابدأ التجربة</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/contact">اطلب عرضًا للشركات</Link>
            </Button>
          </div>
        </Reveal>
      </Section>
    </>
  );
}
