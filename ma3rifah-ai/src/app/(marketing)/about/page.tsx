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
import { Section, SectionHeading } from '@/components/marketing/sections';
import { Reveal } from '@/components/marketing/reveal';

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
 * ما يُقال هنا كله قابل للتحقق: مبادئ نبني بها، وقرارات هندسية اتُّخذت
 * فعلًا وموجودة في المنتج اليوم.
 */

const PRINCIPLES = [
  {
    icon: Languages,
    title: 'العربية ليست خيارًا لاحقًا',
    body:
      'أغلب الأدوات تُبنى للإنجليزية ثم تُترجم واجهتها. نحن بدأنا من العربية: ترتيب الحروف عند استخراج النص، وتوحيد صيغ الهمزة والتاء المربوطة عند المقارنة، وواجهة RTL أصلية. الفرق يظهر في أول مستند عربي تجرّبه.',
  },
  {
    icon: BadgeCheck,
    title: 'الجواب بلا مصدر ليس جوابًا',
    body:
      'لا نعرض إجابة دون أن نقول من أين جاءت. والمصادر المعروضة هي التي استُعملت فعلًا لا كل ما بحثنا فيه — عرض مصادر لم تُستعمل ادّعاء رسوخ لم يحدث، ويجعل التحقق اليدوي متعذّرًا على من أراد أن يراجع.',
  },
  {
    icon: ShieldCheck,
    title: 'الاعتراف بالجهل ميزة لا نقص',
    body:
      'المساعد يقول «لم أجد» بدل أن يخترع. وكل رقم في الإجابة يُقارن بنص المصدر قبل عرضه، فما لا أصل له يظهر عليه تحذير. سياسة مُختلَقة أضرّ على الشركة من سؤال بلا إجابة.',
  },
  {
    icon: ScanSearch,
    title: 'الأداة التي تكشف عيبها أصدق',
    body:
      'كل سؤال لا نجد له إجابة نسجّله ونعرضه على الشركة تقريرًا. نستطيع إخفاءه ليبدو النظام أذكى، لكن ما ينقص توثيقكم أنفع لكم من رقم جميل في لوحة.',
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-accent/40 to-background">
        <div className="tech-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="container relative py-16 sm:py-24">
          <Reveal className="mx-auto max-w-3xl text-center">
            <h1 className="text-balance text-3xl font-bold leading-[1.3] sm:text-4xl">
              نبني أداة معرفة عربية نثق نحن بإجاباتها
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-loose text-muted-foreground sm:text-lg">
              معرفة AI منصة سعودية تحوّل لوائح شركتك وإجراءاتها إلى مساعد ذكي يجيب فريقك
              بالعربية في ثوانٍ — من مستنداتك أنت، ومع ذكر المستند والصفحة تحت كل إجابة.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------ لماذا بدأنا */}
      <Section>
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <SectionHeading align="start" eyebrow="لماذا بدأنا" title="سؤال يتكرر وجواب مكتوب لا يجده أحد" />
          </Reveal>

          <Reveal delay={80}>
            <div className="mt-8 space-y-5 text-base leading-loose text-muted-foreground">
              <p>
                في كل شركة تقريبًا تجد الشيء نفسه: لوائح وإجراءات مكتوبة بعناية، وموظفين
                يسألون عنها زملاءهم لأن لا أحد يعرف في أي ملف كُتبت، ولا في أي صفحة، ولا إن
                كانت النسخة التي يقرؤها هي الأحدث. المعرفة موجودة، والوصول إليها هو المكلف.
              </p>
              <p>
                جرّبنا الأدوات الجاهزة على مستندات عربية حقيقية، فوجدنا مشكلة أخطر من بطء
                البحث: بعضها يستخرج نص PDF العربي بترتيبه البصري لا المنطقي، فتُخزَّن الكلمة
                معكوسة الحروف. النتيجة ليست خطأً ظاهرًا — بل{' '}
                <strong className="font-bold text-foreground">
                  إجابات خاطئة تُعرض بثقة تامة
                </strong>{' '}
                ولا شيء ينبّه القارئ.
              </p>
              <p>
                فبنينا معرفة AI على قاعدة واحدة: أن نثق نحن بالإجابة قبل أن نطلب من الشركة أن
                تثق بها. ومن هذه القاعدة جاء كل قرار في المنتج.
              </p>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* --------------------------------------------------------- المبادئ */}
      <Section muted>
        <Reveal>
          <SectionHeading
            eyebrow="ما يميّزنا"
            title="أربعة مبادئ تجدها في المنتج لا في الشعارات"
            description="كل مبدأ أدناه قرار هندسي مطبَّق اليوم، يمكنك التحقق منه بتجربة واحدة."
          />
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {PRINCIPLES.map((item, index) => (
            <Reveal key={item.title} delay={(index % 2) * 90}>
              <article className="lift h-full rounded-xl border bg-card p-6 sm:p-7">
                <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10">
                  <item.icon className="size-5 text-primary" aria-hidden />
                </div>
                <h3 className="mt-4 text-base font-bold">{item.title}</h3>
                <p className="mt-2.5 text-sm leading-loose text-muted-foreground">{item.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------- لمن نبنيها */}
      <Section>
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <Reveal>
            <SectionHeading
              align="start"
              eyebrow="لمن نبنيها"
              title="الشركات الخدمية الكثيفة الإجراءات"
              description="نركّز على الشركات السعودية التي تعيش على اللوائح والأنظمة، وتُسأل عنها كل يوم."
            />
            <ul className="mt-8 space-y-3">
              {[
                'مكاتب المحاماة والاستشارات النظامية',
                'إدارات الموارد البشرية وشركات التوظيف',
                'المقاولات والهندسة والاشتراطات الفنية',
                'الشركات المالية وفرق الامتثال',
                'المجمّعات الطبية وإجراءاتها التشغيلية',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-relaxed">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={90}>
            <div className="rounded-2xl border bg-card p-6 sm:p-8">
              <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10">
                <Target className="size-5 text-primary" aria-hidden />
              </div>
              <h3 className="mt-4 text-lg font-bold">ما لا نَعِد به</h3>
              <p className="mt-3 text-sm leading-loose text-muted-foreground">
                لا نقول إن المنصة تعرف كل شيء عن شركتك. تعرف ما وثّقتَه فقط — لا أكثر. وإن كانت
                مستنداتك ناقصة فستظهر إجاباتها ناقصة، وسيقول لك تقرير الفجوات أين النقص بالضبط.
              </p>
              <p className="mt-3 text-sm leading-loose text-muted-foreground">
                ولا ندّعي أنها تُغني عن المختصّ في المسائل التي تحتاج اجتهادًا. هي تُسرّع الوصول
                إلى ما هو مكتوب، وتحرّر خبراءك من تكرار ما سبق أن كتبوه.
              </p>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* ------------------------------------------------------ دعوة ختامية */}
      <section className="border-t bg-gradient-to-b from-background to-accent/40">
        <div className="container py-16 sm:py-20">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">جرّبها على مستند واحد من مستنداتك</h2>
            <p className="mt-4 text-base leading-loose text-muted-foreground">
              عشر دقائق تكفي لتعرف إن كانت المنصة تفهم عربيتك أم لا.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild className="group">
                <Link href="/register">
                  ابدأ مجانًا
                  <ArrowLeft
                    className="size-4 transition-transform group-hover:-translate-x-1"
                    aria-hidden
                  />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/contact">تحدّث إلينا</Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
