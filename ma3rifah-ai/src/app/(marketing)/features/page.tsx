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
import {
  Section,
  PageHero,
  FeatureCard,
} from '@/components/marketing/sections';
import { Reveal } from '@/components/marketing/reveal';

export const metadata: Metadata = {
  title: 'المميزات',
  description:
    'مساعد ذكي مبني على مستنداتك، إدارة مستندات، صلاحيات دقيقة، فجوات المعرفة، وتحليلات استخدام — كل ما تحتاجه لتحويل معرفة شركتك إلى أصل قابل للاستخدام.',
};

const FEATURE_GROUPS = [
  {
    title: 'المساعد الذكي',
    description: 'واجهة السؤال والجواب التي يستخدمها موظفوك يوميًا.',
    features: [
      {
        icon: MessagesSquare,
        title: 'محادثة طبيعية',
        description:
          'يسأل الموظف بلغته دون معرفة اسم المستند أو مكانه، ويحصل على إجابة مباشرة.',
      },
      {
        icon: Quote,
        title: 'مصادر مع كل إجابة',
        description:
          'اسم المستند ورقم الصفحة والقسم المرجعي، مع مقتطف من النص الأصلي للتحقق السريع.',
      },
      {
        icon: Languages,
        title: 'عربي وإنجليزي',
        description:
          'يفهم السؤال بأي من اللغتين ويجيب بلغة السائل، حتى لو كانت لغة المستند مختلفة.',
      },
      {
        icon: ScrollText,
        title: 'سجل المحادثات',
        description:
          'كل محادثة محفوظة وقابلة للاستئناف، مع نسخ الإجابة وتقييمها بإبهام لأعلى أو لأسفل.',
      },
    ],
  },
  {
    title: 'الثقة في الإجابة',
    description: 'ما يفصل أداة تُعتمد عليها في لائحة عن روبوت محادثة لطيف.',
    features: [
      {
        icon: BadgeCheck,
        title: 'التحقق من الأرقام',
        description:
          'كل مدة ومهلة ومبلغ في الإجابة يُقارن بنص المصدر. وما لا أصل له يظهر عليه تحذير يسمّيه.',
      },
      {
        icon: Gauge,
        title: 'درجة ثقة ظاهرة',
        description:
          'مع كل إجابة درجة تُحسب من تطابقها مع نص المصادر ومن تحقّق أرقامها — عالية أو متوسطة أو منخفضة.',
      },
      {
        icon: Quote,
        title: 'المصادر المستعملة فقط',
        description:
          'لا نعرض كل ما بحثنا فيه، بل ما بُنيت عليه الإجابة فعلًا. عرض الزائد ادّعاء رسوخ لم يحدث.',
      },
      {
        icon: CircleSlash,
        title: 'يعترف بجهله',
        description:
          'يقول «لم أجد» بدل أن يخترع، ويُسجَّل السؤال فجوةً معرفية بدل أن يضيع.',
      },
    ],
  },
  {
    title: 'إدارة المعرفة',
    description: 'ما يبنيه مدير الشركة مرة واحدة ويستفيد منه الجميع.',
    features: [
      {
        icon: FileStack,
        title: 'رفع ومعالجة المستندات',
        description:
          'PDF وWord وExcel وCSV ونصوص. حالة معالجة واضحة لكل مستند، وسبب مفهوم عند الفشل.',
      },
      {
        icon: FolderTree,
        title: 'تصنيفات المعرفة',
        description:
          'موارد بشرية، مالية، تشغيل، تقنية، سياسات، تدريب — أو تصنيفات تصنعها بنفسك.',
      },
      {
        icon: Search,
        title: 'بحث دلالي',
        description:
          'يبحث بالمعنى لا بتطابق الكلمات، فيجد الجواب حتى لو صاغه الموظف بكلمات مختلفة عن المستند.',
      },
      {
        icon: Workflow,
        title: 'إصدارات المستندات',
        description:
          'ارفع النسخة المحدَّثة وأرشِف القديمة، فتخرج فورًا من نطاق البحث ولا يُجيب منها المساعد.',
      },
    ],
  },
  {
    title: 'التحكم والصلاحيات',
    description: 'من يرى ماذا — محسوم في قاعدة البيانات لا في الواجهة.',
    features: [
      {
        icon: Lock,
        title: 'ثلاثة مستويات وصول',
        description:
          'مستند متاح للشركة كاملة، أو لأقسام محددة، أو لأدوار محددة. الاختيار لكل مستند على حدة.',
      },
      {
        icon: Users,
        title: 'أدوار المستخدمين',
        description:
          'مدير شركة، مدير قسم، وموظف — لكل دور صلاحيات مختلفة مطبَّقة على الخادم.',
      },
      {
        icon: Building2,
        title: 'الأقسام',
        description:
          'نظّم موظفيك في أقسام، واربط صلاحيات المستندات وتحليلات الاستخدام بها.',
      },
      {
        icon: ShieldCheck,
        title: 'سجل تدقيق',
        description:
          'كل عملية حساسة مسجّلة: من رفع، من غيّر صلاحية، من عدّل دورًا، ومتى.',
      },
    ],
  },
  {
    title: 'الرؤية والتحليلات',
    description: 'ما لا يُقاس لا يتحسّن — وهذا ما يميّز المنصة عن روبوت محادثة.',
    features: [
      {
        icon: Target,
        title: 'فجوات المعرفة',
        description:
          'كل سؤال لم يجد إجابة يُسجَّل ويُجمَّع مع مثيله بعدّاد تكرار — قائمة مهام توثيق مرتّبة بأولويتها الحقيقية.',
      },
      {
        icon: PenLine,
        title: 'إجابات معتمدة',
        description:
          'يكتب المدير الجواب مرة واحدة فيدخل قاعدة المعرفة فورًا، ويجده كل من يسأل بعده. الفجوة تُسدّ لا تُوصَف فقط.',
      },
      {
        icon: Bell,
        title: 'تنبيهات داخل المنصة',
        description:
          'يصل الموظف تنبيه حين يصير لسؤاله جواب، ويصل المدير تنبيه بكل فجوة جديدة أو مستند تعذّرت معالجته.',
      },
      {
        icon: BarChart3,
        title: 'تحليلات الاستخدام',
        description:
          'معدل الإجابة، رسوخ الإجابات في مصادرها، الأسئلة عبر الزمن، أكثر المستندات استخدامًا، والنشاط حسب القسم.',
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <>
      <PageHero
        eyebrow="المميزات"
        title="كل ما تحتاجه لتشغيل معرفة شركتك"
        description="من رفع أول مستند، إلى إجابة موثّقة يثق بها موظفك، إلى تقرير يقول لك ما ينقص توثيقك."
      />

      {FEATURE_GROUPS.map((group, index) => (
        <Section key={group.title} muted={index % 2 === 1} className="py-14">
          <Reveal className="mb-10 max-w-2xl">
            <h2 className="text-xl font-bold sm:text-2xl">{group.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {group.description}
            </p>
          </Reveal>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {group.features.map((feature, position) => (
              <Reveal key={feature.title} delay={(position % 4) * 80}>
                <FeatureCard {...feature} />
              </Reveal>
            ))}
          </div>
        </Section>
      ))}

      <Section>
        <Reveal className="rounded-xl border bg-card p-10 text-center">
          <h2 className="text-xl font-bold sm:text-2xl">
            جرّبها على مستند واحد من مستنداتك
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            أسرع طريقة لتقييم المنصة: ارفع سياسة تعرفها جيدًا، واسأل عنها أسئلة تعرف
            إجاباتها، وتحقّق من دقة المصادر.
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
