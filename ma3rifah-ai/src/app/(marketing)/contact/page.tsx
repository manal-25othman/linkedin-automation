import type { Metadata } from 'next';
import { Building2, Clock, Mail, Sparkles } from 'lucide-react';
import { Section } from '@/components/marketing/sections';
import { ContactForm } from './contact-form';

export const metadata: Metadata = {
  title: 'تواصل معنا',
  description:
    'اطلب عرضًا توضيحيًا لمنصة معرفة AI، أو تحدث مع فريقنا حول احتياجات مؤسستك في إدارة المعرفة بالذكاء الاصطناعي.',
};

export default function ContactPage() {
  return (
    <Section>
      <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        <div>
          {/* لا uppercase ولا tracking على العربية — لا معنى للأولى،
              والثانية تفكّ اتصال الحروف بصريًا */}
          <p className="mb-3 flex items-center gap-2 text-sm font-bold text-primary">
            <span className="h-px w-5 bg-primary/45" aria-hidden />
            تواصل معنا
          </p>
          <h1 className="text-balance text-2xl font-bold sm:text-3xl">اطلب عرضًا على مستنداتك</h1>
          <p className="mt-4 text-pretty text-base leading-loose text-muted-foreground">
            أخبرنا عن مؤسستك ونوع المستندات لديكم، ونرتّب جلسة عملية نرفع فيها مستندًا من
            عندكم — بعد موافقتكم — ونسأله أسئلتكم الفعلية أمامكم. خمس عشرة دقيقة تكفي
            لتعرفوا إن كانت المنصة تفهم عربيّتكم أم لا.
          </p>

          <div className="mt-10 space-y-6">
            {[
              {
                icon: Sparkles,
                title: 'عرض على بياناتكم',
                body: 'نرفع مستندًا من عندكم — بعد موافقتكم — ونعرض المساعد وهو يجيب عن أسئلتكم الفعلية.',
              },
              {
                icon: Building2,
                title: 'مناقشة تقنية',
                body: 'فريقنا مستعد للحديث مع فريقكم التقني عن العزل والصلاحيات والتكاملات.',
              },
              {
                icon: Clock,
                title: 'رد خلال يوم عمل',
                body: 'نتواصل معك عادة في نفس اليوم أو اليوم التالي على أبعد تقدير.',
              },
              {
                icon: Mail,
                title: 'تفضّل المراسلة المباشرة؟',
                body: 'sales@ma3rifah.ai',
              },
            ].map((item) => (
              <div key={item.title} className="flex gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <item.icon className="size-4.5 text-primary" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">{item.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
          <ContactForm />
        </div>
      </div>
    </Section>
  );
}
