import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Section, PageHero } from '@/components/marketing/sections';
import { Reveal } from '@/components/marketing/reveal';
import { FaqList } from '@/components/marketing/faq-list';
import { getSiteText } from '@/lib/content/site-text';
import { faqGroups } from '@/lib/content/faq';

export const metadata: Metadata = {
  title: 'الأسئلة الشائعة',
  description:
    'إجابات عن أكثر الأسئلة تكرارًا حول منصة معرفة AI: دقة الإجابات، عزل البيانات، الصلاحيات، أنواع الملفات المدعومة، والاشتراكات.',
};

export default async function FaqPage() {
  const t = await getSiteText();
  const groups = faqGroups(t);

  // بيانات مُهيكلة لمحركات البحث — تُبنى من المحتوى المحرَّر نفسه، فلا
  // تتخلّف عمّا يقرؤه الزائر حين يُعدَّل سؤال أو يُحذف
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: groups.flatMap((group) =>
      group.items.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    ),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageHero
        eyebrow={t('faq.eyebrow')}
        title={t('faq.title')}
        description={t('faq.description')}
      />

      <Section>
        <div className="mx-auto max-w-3xl space-y-12">
          {groups.map((group) => (
            <Reveal key={group.category}>
              <h2 className="mb-5 text-lg font-bold">{group.category}</h2>
              <FaqList items={group.items} />
            </Reveal>
          ))}
        </div>
      </Section>

      <Section muted>
        <div className="text-center">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {t('faq.cta.title')}
          </h2>
          <Button className="mt-6" asChild>
            <Link href="/contact">اسألنا مباشرة</Link>
          </Button>
        </div>
      </Section>
    </>
  );
}
