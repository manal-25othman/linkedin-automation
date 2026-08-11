import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  Clock,
  FileSearch,
  FileStack,
  Languages,
  Lock,
  MessagesSquare,
  Quote,
  SearchX,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Section, SectionHeading, FeatureCard } from '@/components/marketing/sections';
import { PricingTable } from '@/components/marketing/pricing-table';
import { FaqList } from '@/components/marketing/faq-list';
import { HOME_FAQ } from '@/content/faq';

export default function HomePage() {
  return (
    <>
      {/* ------------------------------------------------------------ Hero */}
      <section className="border-b bg-gradient-to-b from-accent/40 to-background">
        <div className="container py-20 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-6 bg-background px-3 py-1">
              <Sparkles className="size-3.5 text-primary" aria-hidden />
              ذكاء معرفي مبني على مستندات شركتك
            </Badge>

            <h1 className="text-3xl font-semibold leading-[1.3] tracking-tight sm:text-5xl sm:leading-[1.25]">
              حوّل معرفة شركتك إلى ذكاء يعمل معك.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg sm:leading-relaxed">
              منصة ذكاء معرفي تساعد فرقك على الوصول إلى سياسات وإجراءات ومستندات الشركة
              والحصول على إجابات موثوقة في ثوانٍ.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/register">
                  ابدأ التجربة
                  <ArrowLeft className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/contact">اطلب عرضًا للشركات</Link>
              </Button>
            </div>

            <p className="mt-5 text-sm text-muted-foreground">
              لا يتطلب بطاقة ائتمانية · جاهز للاستخدام خلال دقائق
            </p>
          </div>

          {/* معاينة الإجابة — توضّح المنتج بدل وصفه */}
          <div className="mx-auto mt-16 max-w-3xl">
            <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-7">
              <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                  م
                </div>
                <p className="pt-1 text-sm font-medium">ما سياسة الإجازات السنوية في الشركة؟</p>
              </div>

              <div className="mt-5 flex items-start gap-3 border-t pt-5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="size-4 text-primary" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed">
                    رصيد الإجازة السنوية 21 يوم عمل لمن أمضى أقل من خمس سنوات، ويرتفع إلى
                    30 يومًا بعد إتمام خمس سنوات متصلة. تُقدَّم الطلبات عبر نظام الموارد
                    البشرية قبل 7 أيام عمل على الأقل.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
                      <Quote className="size-3" aria-hidden />
                      سياسة الإجازات.pdf — صفحة 3
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
                      <Quote className="size-3" aria-hidden />
                      دليل الموظف.pdf — صفحة 12
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              مثال توضيحي من بيانات شركة تجريبية
            </p>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- المشكلة */}
      <Section>
        <SectionHeading
          eyebrow="المشكلة"
          title="معرفة شركتك موجودة — لكن الوصول إليها مكلف"
          description="المعلومة مكتوبة فعلًا في مستند ما. المشكلة أن أحدًا لا يعرف في أي مستند، ولا في أي صفحة."
        />

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: FileStack,
              title: 'معلومات موزّعة',
              description:
                'السياسات في PDF، الإجراءات في Word، البيانات في Excel، والباقي في أدلة ورسائل قديمة. لا مصدر واحد للحقيقة.',
            },
            {
              icon: Clock,
              title: 'وقت ضائع في البحث',
              description:
                'الموظف يبحث في مجلدات مشتركة، ثم يسأل زميلًا، ثم ينتظر ردًا. سؤال بسيط يستهلك نصف يوم.',
            },
            {
              icon: SearchX,
              title: 'إجابات متضاربة',
              description:
                'كل موظف يجيب من ذاكرته أو من نسخة قديمة من السياسة، فتتباين الإجابات عن نفس السؤال.',
            },
          ].map((item) => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </div>
      </Section>

      {/* ----------------------------------------------------------- الحل */}
      <Section muted>
        <SectionHeading
          eyebrow="الحل"
          title="مساعد معرفة داخلي يقرأ مستندات شركتك"
          description="ارفع مستنداتك مرة واحدة. بعدها يسأل موظفوك بلغتهم الطبيعية ويحصلون على إجابة مبنية على مستندات الشركة وحدها — مع ذكر المصدر."
        />

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: FileSearch,
              title: 'إجابات من مستنداتك فقط',
              description:
                'المساعد لا يجيب من معرفته العامة عن أسئلة الشركة. إن لم تكن المعلومة في قاعدة المعرفة، يقولها صراحة بدل أن يخترع.',
            },
            {
              icon: Quote,
              title: 'كل إجابة موثقة بالمصدر',
              description:
                'مع كل إجابة يظهر اسم المستند ورقم الصفحة، فيستطيع الموظف التحقق بنفسه والرجوع إلى الأصل.',
            },
            {
              icon: Languages,
              title: 'عربي وإنجليزي',
              description:
                'يفهم السؤال بالعربية أو الإنجليزية ويجيب بلغة السائل، حتى لو كان المستند بلغة أخرى.',
            },
          ].map((item) => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------- كيف يعمل */}
      <Section id="how-it-works">
        <SectionHeading eyebrow="كيف يعمل" title="أربع خطوات من المستند إلى الإجابة" />

        <div className="mx-auto mt-14 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              step: '1',
              icon: Upload,
              title: 'ارفع مستنداتك',
              description: 'PDF وWord وExcel وCSV ونصوص. صنّفها حسب الجهة: موارد بشرية، مالية، تشغيل.',
            },
            {
              step: '2',
              icon: Sparkles,
              title: 'المنصة تفهرسها',
              description: 'استخراج النص، تقسيمه إلى مقاطع، وبناء فهرس دلالي يفهم المعنى لا الكلمات فقط.',
            },
            {
              step: '3',
              icon: MessagesSquare,
              title: 'الموظف يسأل',
              description: 'سؤال بلغة طبيعية عبر واجهة محادثة، دون الحاجة لمعرفة اسم المستند.',
            },
            {
              step: '4',
              icon: BarChart3,
              title: 'أنت تتعلّم',
              description: 'تحليلات تُظهر أكثر الأسئلة تكرارًا، والأسئلة التي لم تجد إجابة في مستنداتك.',
            },
          ].map((item) => (
            <div key={item.step} className="relative">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {item.step}
                </span>
                <item.icon className="size-5 text-muted-foreground" aria-hidden />
              </div>
              <h3 className="text-base font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* -------------------------------------------------------- المميزات */}
      <Section muted>
        <SectionHeading
          eyebrow="المميزات"
          title="ليس روبوت محادثة — منصة لإدارة المعرفة"
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: MessagesSquare,
              title: 'مساعد ذكي',
              description:
                'واجهة محادثة مع سجل كامل للمحادثات، نسخ الإجابات، وتقييمها لتحسين جودة المعرفة.',
            },
            {
              icon: FileStack,
              title: 'إدارة المستندات',
              description:
                'رفع، تصنيف، إصدارات، وحالة معالجة واضحة لكل مستند مع سبب الفشل عند حدوثه.',
            },
            {
              icon: Lock,
              title: 'صلاحيات دقيقة',
              description:
                'مستند لقسم واحد، أو لدور محدد، أو للشركة كاملة. التحقق يتم في قاعدة البيانات لا في الواجهة.',
            },
            {
              icon: Target,
              title: 'فجوات المعرفة',
              description:
                'كل سؤال لم يجد إجابة يُسجَّل ويُجمَّع مع مثيله. تعرف بالضبط ما ينقص توثيقك.',
            },
            {
              icon: BarChart3,
              title: 'تحليلات الاستخدام',
              description:
                'معدل الإجابة، أكثر الأسئلة تداولًا، أكثر المستندات استخدامًا، والنشاط حسب القسم.',
            },
            {
              icon: Users,
              title: 'إدارة المستخدمين',
              description:
                'أدوار وأقسام وحالات تفعيل. أضف موظفًا وحدّد ما يراه في دقيقة واحدة.',
            },
          ].map((item) => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------------- الأمان */}
      <Section>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              align="start"
              eyebrow="الأمان"
              title="بيانات كل شركة معزولة تمامًا"
              description="العزل ليس شرطًا في كود التطبيق يمكن نسيانه — بل مطبَّق في قاعدة البيانات نفسها عبر Row Level Security. لا يمكن لاستعلام أن يعبر حدود الشركة حتى لو أخطأ المطوّر."
            />
            <ul className="mt-8 space-y-4">
              {[
                'عزل كامل بين الشركات على مستوى كل صف في قاعدة البيانات',
                'تحقق من الصلاحيات على الخادم، ولا يُعتمد على الواجهة إطلاقًا',
                'تشفير البيانات أثناء النقل والتخزين',
                'سجل تدقيق لكل عملية حساسة: من فعل ماذا ومتى',
                'مفاتيح الخدمة لا تصل إلى المتصفح إطلاقًا',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                  <span className="text-sm leading-relaxed text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
            <Button variant="outline" className="mt-8" asChild>
              <Link href="/security">
                تفاصيل الأمان
                <ArrowLeft className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>

          <div className="rounded-xl border bg-muted/30 p-8">
            <h3 className="text-base font-semibold">قاعدة المساعد الأساسية</h3>
            <div className="mt-5 rounded-lg border bg-background p-5">
              <p className="text-sm leading-relaxed text-muted-foreground">
                عندما لا تكفي المصادر، لا يُخمّن المساعد. يقول:
              </p>
              <p className="mt-3 rounded-md bg-muted/60 p-3 text-sm font-medium leading-relaxed">
                «لم أجد معلومات كافية في قاعدة معرفة الشركة للإجابة عن هذا السؤال.»
              </p>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                هذا ليس قصورًا — بل تصميم مقصود. سياسة مُختلَقة تكلّف الشركة أكثر بكثير من
                سؤال بلا إجابة. وكل سؤال كهذا يُسجَّل تلقائيًا في «فجوات المعرفة» ليصبح مهمة
                توثيق واضحة.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* --------------------------------------------------------- الأسعار */}
      <Section muted id="pricing">
        <SectionHeading
          eyebrow="الأسعار"
          title="خطط واضحة تنمو مع فريقك"
          description="جميع الخطط تشمل المساعد الذكي وقاعدة المعرفة والتحليلات الأساسية."
        />
        <div className="mt-14">
          <PricingTable />
        </div>
      </Section>

      {/* ------------------------------------------------- الأسئلة الشائعة */}
      <Section>
        <SectionHeading eyebrow="الأسئلة الشائعة" title="أسئلة يطرحها فرق التقنية والموارد البشرية" />
        <div className="mx-auto mt-12 max-w-3xl">
          <FaqList items={HOME_FAQ} />
        </div>
        <div className="mt-10 text-center">
          <Button variant="outline" asChild>
            <Link href="/faq">
              كل الأسئلة
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </Section>

      {/* ------------------------------------------------------ CTA أخير */}
      <section className="border-t bg-primary">
        <div className="container py-16 text-center sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-primary-foreground sm:text-3xl">
            ابدأ بمستند واحد. اسأل سؤالًا واحدًا.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-primary-foreground/85">
            لا تحتاج مشروع تحوّل رقمي. ارفع سياسة الإجازات فقط، واسأل عنها، وقرّر بعدها.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" variant="secondary" asChild>
              <Link href="/register">ابدأ التجربة</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              asChild
            >
              <Link href="/contact">اطلب عرضًا للشركات</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
