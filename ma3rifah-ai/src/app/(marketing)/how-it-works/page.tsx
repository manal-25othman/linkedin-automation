import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Section, SectionHeading } from '@/components/marketing/sections';

export const metadata: Metadata = {
  title: 'كيف يعمل',
  description:
    'من رفع المستند إلى الإجابة الموثقة: شرح خطوة بخطوة لكيفية تحويل مستندات شركتك إلى قاعدة معرفة ذكية باستخدام تقنية RAG.',
};

const STEPS = [
  {
    number: '1',
    title: 'ارفع مستنداتك وصنّفها',
    body: 'ارفع سياسات الموارد البشرية، أدلة التشغيل، إجراءات المشتريات، ودليل الموظف. لكل مستند تحدّد تصنيفه ومن يُسمح له بالوصول إليه: الشركة كاملة، أقسام محددة، أو أدوار محددة.',
    points: [
      'PDF · DOCX · XLSX · CSV · TXT · MD',
      'حتى 25 ميجابايت للملف الواحد',
      'صلاحيات تُضبط لكل مستند على حدة',
    ],
  },
  {
    number: '2',
    title: 'المنصة تفهرس المحتوى',
    body: 'تستخرج المنصة النص، تنظّفه من تشوّهات ملفات PDF العربية، ثم تقسّمه إلى مقاطع متداخلة تحافظ على سياق الجمل. كل مقطع يُحوَّل إلى تمثيل رقمي يُخزَّن في فهرس دلالي داخل قاعدة البيانات.',
    points: [
      'تقسيم يحترم حدود الفقرات والعناوين',
      'ربط كل مقطع برقم صفحته لتوثيق المصدر',
      'حالة المعالجة ظاهرة لحظيًا للمستخدم',
    ],
  },
  {
    number: '3',
    title: 'الموظف يسأل بلغته',
    body: 'عند السؤال، يُحوَّل السؤال نفسه إلى تمثيل رقمي ويُقارَن بالمقاطع المفهرسة لاختيار الأقرب معنًى. الفلترة بالصلاحيات تحدث داخل قاعدة البيانات قبل أن يرى النظام أي مقطع.',
    points: [
      'بحث بالمعنى لا بتطابق الكلمات',
      'الصلاحيات مطبَّقة قبل الاسترجاع لا بعده',
      'عربي وإنجليزي',
    ],
  },
  {
    number: '4',
    title: 'المساعد يجيب مع المصدر',
    body: 'تُرسل المقاطع المسموح بها فقط إلى النموذج مع تعليمات صارمة: أجب من هذه المصادر وحدها. تظهر الإجابة مع قائمة المستندات وأرقام الصفحات، ويمكن تقييمها بإبهام لأعلى أو لأسفل.',
    points: [
      'لا إجابة من خارج مستنداتك',
      'إفصاح صريح عند عدم كفاية المصادر',
      'تنبيه واضح عند تعارض المصادر',
    ],
  },
  {
    number: '5',
    title: 'أنت تتعلّم أين النقص',
    body: 'كل سؤال لم تكفِ مصادره يُسجَّل في «فجوات المعرفة»، وتُجمَّع الأسئلة المتشابهة في سجل واحد مع عدّاد تكرار. النتيجة قائمة توثيق مرتبة حسب ما يحتاجه فريقك فعلًا، لا حسب التخمين.',
    points: [
      'تجميع تلقائي للأسئلة المتشابهة',
      'عدّاد تكرار يحدد الأولوية',
      'ربط الفجوة بمستند جديد لإغلاقها',
    ],
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <Section className="pb-10">
        <SectionHeading
          eyebrow="كيف يعمل"
          title="من المستند إلى الإجابة الموثقة"
          description="شرح واضح لما يحدث خلف الواجهة، لأن فرق التقنية تسأل عن هذا أولًا."
        />
      </Section>

      <Section className="pt-0">
        <div className="mx-auto max-w-4xl">
          {STEPS.map((step, index) => (
            <div key={step.number} className="relative flex gap-6 pb-12 last:pb-0 sm:gap-8">
              {/* الخط الواصل بين الخطوات */}
              {index < STEPS.length - 1 ? (
                <div
                  aria-hidden
                  className="absolute top-12 h-[calc(100%-3rem)] w-px bg-border"
                  style={{ insetInlineStart: '1.375rem' }}
                />
              ) : null}

              <div className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
                {step.number}
              </div>

              <div className="min-w-0 flex-1 pt-1">
                <h3 className="text-lg font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
                <ul className="mt-4 space-y-2">
                  {step.points.map((point) => (
                    <li key={point} className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      <span className="text-sm text-muted-foreground">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section muted>
        <div className="mx-auto max-w-3xl rounded-xl border bg-card p-8">
          <h2 className="text-lg font-semibold">لماذا لا نكتفي بنموذج ذكاء اصطناعي عام؟</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            النموذج العام لا يعرف سياسة إجازاتك ولا سقف مشترياتك. إذا سُئل عنها فسيجيب
            بما هو «معتاد» في الشركات — وهي إجابة تبدو معقولة وقد تكون خاطئة تمامًا في
            حالتك. هذا النوع من الخطأ هو الأخطر، لأنه يمرّ دون أن ينتبه له أحد.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            الاسترجاع المعزّز (RAG) يعالج ذلك جذريًا: نُلزم النموذج بأن يبني إجابته من
            مقاطع مستنداتك فقط، ونعرض المصدر لكل إجابة. النتيجة أن الموظف يستطيع التحقق،
            والشركة تستطيع المحاسبة.
          </p>
        </div>
      </Section>

      <Section>
        <div className="text-center">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            جاهز لتجربتها على مستنداتك؟
          </h2>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/register">
                ابدأ التجربة
                <ArrowLeft className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/contact">اطلب عرضًا للشركات</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
