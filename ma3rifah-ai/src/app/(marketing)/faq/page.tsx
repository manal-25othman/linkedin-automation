import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Section, PageHero } from '@/components/marketing/sections';
import { Reveal } from '@/components/marketing/reveal';
import { FaqList } from '@/components/marketing/faq-list';
import { FULL_FAQ } from '@/content/faq';

export const metadata: Metadata = {
  title: 'الأسئلة الشائعة',
  description:
    'إجابات عن أكثر الأسئلة تكرارًا حول منصة معرفة AI: دقة الإجابات، عزل البيانات، الصلاحيات، أنواع الملفات المدعومة، والاشتراكات.',
};

export default function FaqPage() {
  // بيانات مُهيكلة لمحركات البحث
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FULL_FAQ.flatMap((group) =>
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
        eyebrow="الأسئلة الشائعة"
        title="ما يسأل عنه العملاء قبل التبنّي"
        description="أسئلة الأمان والتكلفة والدقة — مجموعة كما تُطرح فعلًا. لم تجد سؤالك؟ تواصل معنا وسنجيبك خلال يوم عمل."
      />

      <Section>
        <div className="mx-auto max-w-3xl space-y-12">
          {FULL_FAQ.map((group) => (
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
            سؤالك غير مذكور هنا؟
          </h2>
          <Button className="mt-6" asChild>
            <Link href="/contact">اسألنا مباشرة</Link>
          </Button>
        </div>
      </Section>
    </>
  );
}
