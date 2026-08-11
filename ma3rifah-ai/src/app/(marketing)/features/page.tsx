import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BarChart3,
  Building2,
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
import { Section, SectionHeading, FeatureCard } from '@/components/marketing/sections';

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
          'كل سؤال لم يجد إجابة يُسجَّل ويُجمَّع مع مثيله مع عدّاد تكرار. قائمة مهام توثيق مرتبة حسب الأولوية الحقيقية.',
      },
      {
        icon: BarChart3,
        title: 'تحليلات الاستخدام',
        description:
          'معدل الإجابة، الأسئلة عبر الزمن، أكثر الأسئلة تداولًا، أكثر المستندات استخدامًا، والنشاط حسب القسم.',
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <>
      <Section className="pb-8">
        <SectionHeading
          eyebrow="المميزات"
          title="كل ما تحتاجه لتشغيل معرفة شركتك"
          description="من رفع أول مستند إلى قياس أثر المنصة على وقت فريقك."
        />
      </Section>

      {FEATURE_GROUPS.map((group, index) => (
        <Section key={group.title} muted={index % 2 === 1} className="py-14">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{group.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {group.description}
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {group.features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </Section>
      ))}

      <Section>
        <div className="rounded-xl border bg-card p-10 text-center">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
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
        </div>
      </Section>
    </>
  );
}
