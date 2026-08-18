import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Section, SectionHeading, PageHero } from '@/components/marketing/sections';
import { Reveal } from '@/components/marketing/reveal';
import { PricingTable } from '@/components/marketing/pricing-table';
import { FaqList } from '@/components/marketing/faq-list';
import { getSiteText } from '@/lib/content/site-text';
import { faqByCategory } from '@/lib/content/faq';

export const metadata: Metadata = {
  title: 'الأسعار',
  description:
    'خطط اشتراك واضحة لمنصة معرفة AI: Starter وBusiness وEnterprise. جميع الخطط تشمل المساعد الذكي وقاعدة المعرفة والتحليلات.',
};

export default async function PricingPage() {
  const t = await getSiteText();

  // القسم يُطابَق باسمه كما يظهر في المحرِّر. وإن أُعيدت تسميته لم يُعرض
  // القسم هنا — أهون من عرض أسئلة قسم آخر تحت عنوان الاشتراك.
  const billingFaq = faqByCategory(t, 'الاشتراك والفوترة');

  return (
    <>
      <PageHero
        eyebrow={t('pricing.eyebrow')}
        title={t('pricing.title')}
        description={t('pricing.description')}
      />

      <Section>
        <Reveal>
          <PricingTable />
        </Reveal>
        <p className="mt-8 text-center text-sm text-muted-foreground">{t('pricing.note')}</p>
      </Section>

      <Section muted>
        <SectionHeading title={t('pricing.counted.title')} />
        <div className="mx-auto mt-10 grid max-w-4xl gap-6 sm:grid-cols-3">
          {t.list('pricing.counted.items').map((item, index) => (
            <div key={`${item.title}-${index}`} className="rounded-xl border bg-card p-6">
              <h3 className="text-base font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {billingFaq.length > 0 ? (
        <Section>
          <SectionHeading title={t('pricing.billing.title')} />
          <div className="mx-auto mt-10 max-w-3xl">
            <FaqList items={billingFaq} />
          </div>
        </Section>
      ) : null}

      <Section muted>
        <div className="text-center">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {t('pricing.cta.title')}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {t('pricing.cta.description')}
          </p>
          <Button className="mt-7" asChild>
            <Link href="/contact">تواصل مع المبيعات</Link>
          </Button>
        </div>
      </Section>
    </>
  );
}
