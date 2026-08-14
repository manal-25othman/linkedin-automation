import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Section, SectionHeading, PageHero } from '@/components/marketing/sections';
import { Reveal } from '@/components/marketing/reveal';
import { PricingTable } from '@/components/marketing/pricing-table';
import { FaqList } from '@/components/marketing/faq-list';
import { FULL_FAQ } from '@/content/faq';

export const metadata: Metadata = {
  title: 'الأسعار',
  description:
    'خطط اشتراك واضحة لمنصة معرفة AI: Starter وBusiness وEnterprise. جميع الخطط تشمل المساعد الذكي وقاعدة المعرفة والتحليلات.',
};

const billingFaq = FULL_FAQ.find((group) => group.category === 'الاشتراك والفوترة');

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="الأسعار"
        title="خطط واضحة تنمو مع فريقك"
        description="ابدأ بلا بطاقة ائتمانية، وارتقِ حين يتوسّع استخدام فريقك. بلا رسوم تأسيس ولا عقد سنة إلزامي."
      />

      <Section>
        <Reveal>
          <PricingTable />
        </Reveal>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          الأسعار بالريال السعودي شهريًا ولا تشمل ضريبة القيمة المضافة.
        </p>
      </Section>

      <Section muted>
        <SectionHeading title="ما الذي يُحتسب؟" />
        <div className="mx-auto mt-10 grid max-w-4xl gap-6 sm:grid-cols-3">
          {[
            {
              title: 'المستخدمون',
              body: 'كل حساب نشط في شركتك. الحسابات المعطّلة لا تُحتسب، فيمكنك تعطيل حساب موظف غادر دون فقد بياناته.',
            },
            {
              title: 'المستندات',
              body: 'عدد المستندات المفهرسة في قاعدة المعرفة. المستندات المؤرشفة تبقى محفوظة ولا تُحتسب ضمن الحد.',
            },
            {
              title: 'الأسئلة',
              body: 'كل سؤال يوجّهه موظف إلى المساعد خلال الشهر. يُعاد ضبط العدّاد مع بداية كل شهر ميلادي.',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border bg-card p-6">
              <h3 className="text-base font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {billingFaq ? (
        <Section>
          <SectionHeading title="أسئلة حول الاشتراك" />
          <div className="mx-auto mt-10 max-w-3xl">
            <FaqList items={billingFaq.items} />
          </div>
        </Section>
      ) : null}

      <Section muted>
        <div className="text-center">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            احتياجاتك أكبر من الخطط المعروضة؟
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            خطة Enterprise تُبنى حسب حجم مؤسستك ومتطلبات الامتثال والتكاملات لديك.
          </p>
          <Button className="mt-7" asChild>
            <Link href="/contact">تواصل مع المبيعات</Link>
          </Button>
        </div>
      </Section>
    </>
  );
}
