import Link from 'next/link';
import {
  ArrowLeft,
  BadgeCheck,
  BrainCircuit,
  Building2,
  ClipboardCheck,
  Clock,
  FileWarning,
  Languages,
  Lock,
  MessagesSquare,
  Repeat2,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  UserMinus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Section, SectionHeading } from '@/components/marketing/sections';
import { Reveal } from '@/components/marketing/reveal';
import { HeroDemo, Pulse } from '@/components/marketing/hero-demo';
import { PricingTable } from '@/components/marketing/pricing-table';
import { FaqList } from '@/components/marketing/faq-list';
import { HOME_FAQ } from '@/content/faq';

/**
 * الصفحة الرئيسية.
 *
 * قاعدة الصياغة هنا: لا جملة تصلح لمنافس. «منصة ذكاء معرفي تساعد فرقك»
 * يقولها الجميع فلا تُقنع أحدًا. كل قسم أدناه يقول شيئًا واحدًا محدّدًا
 * يستطيع الزائر التحقق منه أو رؤيته بعينه.
 *
 * وليس في الصفحة شهادة عميل ولا شعار شركة ولا إحصاءة سوق — لا عملاء بعد،
 * واختلاق ذلك يُكتشف في أول اجتماع ويُفقد الصفقة كلها.
 */

export default function HomePage() {
  return (
    <>
      {/* ------------------------------------------------------------ Hero */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-accent/50 via-background to-background">
        <div className="tech-grid pointer-events-none absolute inset-0" aria-hidden />

        <div className="container relative py-20 sm:py-28">
          <div className="reveal-now mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-6 gap-2 bg-background px-3 py-1">
              <Pulse />
              مبنيّة للعربية أولًا — لا مترجَمة إليها
            </Badge>

            <h1 className="text-balance text-3xl font-semibold leading-[1.3] tracking-tight sm:text-5xl sm:leading-[1.22]">
              موظفوك يسألون السؤال نفسه كل أسبوع.
              <br />
              <span className="text-shimmer">أجب مرة واحدة — إلى الأبد.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-loose text-muted-foreground sm:text-lg">
              ارفع لوائح شركتك وإجراءاتها، فتصير مساعدًا ذكيًا يجيب فريقك بالعربية في ثوانٍ —
              من مستنداتك أنت، ومع ذكر المستند والصفحة تحت كل إجابة.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
                <Link href="/contact">اطلب عرضًا على مستنداتك</Link>
              </Button>
            </div>

            <p className="mt-5 text-sm text-muted-foreground">
              بلا بطاقة ائتمانية · جاهزة خلال دقائق · بياناتك لا تُدرَّب عليها أي نماذج
            </p>
          </div>

          <div className="reveal-now mt-16" style={{ animationDelay: '120ms' }}>
            <HeroDemo />
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- المشكلة */}
      <Section>
        <Reveal>
          <SectionHeading
            eyebrow="المشكلة"
            title="معرفة شركتك مكتوبة فعلًا — لكن لا أحد يجدها"
            description="المعلومة موجودة في مستند ما. المشكلة أن أحدًا لا يعرف في أي مستند، ولا في أي صفحة، ولا إن كانت النسخة التي يقرأها هي الأحدث."
          />
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Repeat2,
              title: 'السؤال نفسه كل أسبوع',
              description:
                'مدير الموارد البشرية يشرح سياسة الإجازات للمرة المئة. وقتُ أغلى موظفيك يذهب في تكرار لا في عمل.',
            },
            {
              icon: Clock,
              title: 'موظف جديد ينتظر',
              description:
                'يقضي أسابيعه الأولى يسأل زملاءه ويعتذر عن الإزعاج. والإجابة التي يحصل عليها تعتمد على من سأل.',
            },
            {
              icon: UserMinus,
              title: 'خبير يستقيل',
              description:
                'يخرج ومعه ما لم يُكتب قط. تكتشف الشركة بعد شهر أن نصف إجراءاتها كان في رأسه وحده.',
            },
          ].map((item, index) => (
            <Reveal key={item.title} delay={index * 110}>
              <article className="lift h-full rounded-xl border bg-card p-6">
                <div className="flex size-11 items-center justify-center rounded-lg bg-destructive/10">
                  <item.icon className="size-5 text-destructive" aria-hidden />
                </div>
                <h3 className="mt-4 text-base font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------ ما يميّزنا */}
      <Section muted>
        <Reveal>
          <SectionHeading
            eyebrow="ما يميّزنا"
            title="ثلاثة أشياء لا تجدها في أداة عامة"
            description="الفرق ليس في أن المساعد يجيب — كل الأدوات تجيب. الفرق في أن تعرف من أين جاء الجواب، وأن تثق أنه لم يُخترع."
          />
        </Reveal>

        <div className="mt-14 space-y-6">
          {[
            {
              icon: Languages,
              badge: 'العربية',
              title: 'نقرأ العربية كما تُكتب لا كما تُرسم',
              description:
                'كثير من الأدوات تستخرج نص PDF العربي بترتيبه البصري، فتُخزَّن «خلافات» بصيغة «خالفات» — ثم تعطي إجابات خاطئة بثقة تامة دون أن يظهر أي خطأ. عالجنا ترتيب الحروف وروابط لام-ألف واستنتاج المسافات، وثبّتنا ذلك باختبارات تقارن النص بنقاط الترميز لا بشكله.',
            },
            {
              icon: BadgeCheck,
              badge: 'التحقق',
              title: 'كل رقم يُقارن بالمستند قبل أن يصلك',
              description:
                'رقم مخترَع في لائحة ليس خطأً تقنيًا بل مخالفة. لذلك تُقارن أرقام الإجابة — المُدد والمهل والمبالغ — بنص المصادر، وما لا أصل له يظهر عليه تحذير باسمه. ومع كل إجابة درجة ثقة ظاهرة، والمصادر المعروضة هي التي استُعملت فعلًا لا كل ما بحثنا فيه.',
            },
            {
              icon: ScanSearch,
              badge: 'الفجوات',
              title: 'تكشف ما لا توثّقه شركتك — ثم تسدّه',
              description:
                'كل سؤال لا تجد له إجابة يُسجَّل «فجوة معرفية». يفتحها المدير ويكتب الجواب، فيدخل قاعدة المعرفة فورًا ويصل تنبيه لمن سأل. المنصة تصير أذكى بمعرفة شركتك نفسها كلما استُعملت.',
            },
          ].map((item, index) => (
            <Reveal key={item.title} delay={index * 90}>
              <article className="lift rounded-2xl border bg-card p-6 sm:p-8">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <item.icon className="size-6 text-primary" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Badge variant="secondary" className="mb-2">
                      {item.badge}
                    </Badge>
                    <h3 className="text-lg font-semibold leading-snug">{item.title}</h3>
                    <p className="mt-3 text-sm leading-loose text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------- كيف تعمل */}
      <Section>
        <Reveal>
          <SectionHeading eyebrow="كيف تعمل" title="من المستند إلى الإجابة في أربع خطوات" />
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              step: '١',
              title: 'ارفع مستنداتك',
              description: 'PDF و Word و Excel — لوائح، إجراءات، سياسات، أدلة تشغيل.',
            },
            {
              step: '٢',
              title: 'تُفهرَس تلقائيًا',
              description: 'تُقرأ وتُقسَّم وتُفهرس للبحث بالمعنى لا بمطابقة الكلمة.',
            },
            {
              step: '٣',
              title: 'يسأل فريقك',
              description: 'بالعربية الطبيعية، ويحصل على جواب مع مصدره وصفحته.',
            },
            {
              step: '٤',
              title: 'تتعلّم أنت',
              description: 'تقرير يقول لك ما يسأل عنه فريقك وما لا يجيب عنه توثيقك.',
            },
          ].map((item, index) => (
            <Reveal key={item.step} delay={index * 100}>
              <div className="lift relative h-full rounded-xl border bg-card p-6">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {item.step}
                </span>
                <h3 className="mt-4 text-base font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* --------------------------------------------------------- الأمان */}
      <Section muted>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <SectionHeading
              align="start"
              eyebrow="الأمان"
              title="العزل بين الشركات مُثبَت لا موعود"
              description="كل مزوّد يقول «بياناتك آمنة». نقول بدلها ما يمكن التحقق منه: العزل مفروض في قاعدة البيانات نفسها لا في الواجهة، ومعه اختبارات تُنفَّذ بصلاحيات مستخدم حقيقي."
            />
            <div className="mt-8">
              <Button variant="outline" asChild>
                <Link href="/security">
                  اقرأ تفاصيل الأمان
                  <ArrowLeft className="size-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                icon: Building2,
                title: 'عزل تام بين الشركات',
                description: 'لا مسار برمجي يصل ببيانات شركة إلى أخرى.',
              },
              {
                icon: Lock,
                title: 'صلاحيات على مستوى المستند',
                description: 'ما لا يحق للموظف قراءته لا يدخل سياق المساعد أصلًا.',
              },
              {
                icon: ClipboardCheck,
                title: 'سجل تدقيق كامل',
                description: 'كل عملية حساسة مسجَّلة بفاعلها ووقتها.',
              },
              {
                icon: BrainCircuit,
                title: 'وثائقك لا تُدرَّب عليها',
                description: 'مستنداتك تُستعمل للإجابة عليك وحدك، ولا تُغذّي أي نموذج.',
              },
            ].map((item, index) => (
              <Reveal key={item.title} delay={index * 90}>
                <div className="lift h-full rounded-xl border bg-card p-5">
                  <item.icon className="size-5 text-primary" aria-hidden />
                  <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      {/* -------------------------------------------------------- المميزات */}
      <Section>
        <Reveal>
          <SectionHeading
            eyebrow="المنصة"
            title="ليست روبوت محادثة — منصة لإدارة المعرفة"
          />
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: MessagesSquare,
              title: 'مساعد يعترف بجهله',
              description:
                'يقول «لم أجد» بدل أن يخترع. سياسة مُختلَقة أضرّ على شركتك من سؤال بلا إجابة.',
            },
            {
              icon: Sparkles,
              title: 'إجابات معتمدة',
              description:
                'يكتب المدير الجواب مرة واحدة فيدخل قاعدة المعرفة، ويجده كل من يسأل بعده.',
            },
            {
              icon: FileWarning,
              title: 'فجوات المعرفة',
              description:
                'تقرير بما يسأل عنه فريقك ولا يجده — أوضح دليل على ما ينقص توثيقكم.',
            },
            {
              icon: ShieldCheck,
              title: 'مقياس جودة الإجابات',
              description:
                'متوسط رسوخ الإجابات في المصادر، وعدد الإجابات التي حملت رقمًا غير مؤكد.',
            },
            {
              icon: Languages,
              title: 'عربي وإنجليزي',
              description: 'يجيب بلغة السؤال، وواجهة عربية RTL أصلية لا معكوسة بحيلة.',
            },
            {
              icon: Lock,
              title: 'أربعة أدوار وصلاحيات دقيقة',
              description: 'مالك المنصة، مدير الشركة، مدير القسم، وموظف — لكل حدوده.',
            },
          ].map((item, index) => (
            <Reveal key={item.title} delay={(index % 3) * 90}>
              <div className="lift h-full rounded-xl border bg-card p-6">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <item.icon className="size-5 text-primary" aria-hidden />
                </div>
                <h3 className="mt-4 text-base font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* --------------------------------------------------------- الأسعار */}
      <Section muted id="pricing">
        <Reveal>
          <SectionHeading
            eyebrow="الأسعار"
            title="خطط واضحة تنمو مع فريقك"
            description="بالريال السعودي شهريًا، غير شاملة ضريبة القيمة المضافة."
          />
        </Reveal>
        <Reveal className="mt-14" delay={100}>
          <PricingTable />
        </Reveal>
      </Section>

      {/* --------------------------------------------------- أسئلة شائعة */}
      <Section>
        <Reveal>
          <SectionHeading
            eyebrow="الأسئلة الشائعة"
            title="ما يسأل عنه مديرو التقنية والموارد البشرية"
          />
        </Reveal>
        <Reveal className="mx-auto mt-12 max-w-3xl" delay={80}>
          <FaqList items={HOME_FAQ} />
        </Reveal>
      </Section>

      {/* ------------------------------------------------------ دعوة ختامية */}
      <section className="border-t bg-gradient-to-b from-background to-accent/40">
        <div className="container py-20 sm:py-24">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              جرّبها على مستند واحد من مستنداتك
            </h2>
            <p className="mt-4 text-base leading-loose text-muted-foreground">
              ارفع لائحة أو دليل إجراءات، واسأله سؤالًا تعرف إجابته. عشر دقائق تكفي لتعرف
              إن كانت المنصة تفهم عربيتك أم لا.
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
