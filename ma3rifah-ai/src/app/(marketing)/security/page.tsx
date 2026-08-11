import type { Metadata } from 'next';
import Link from 'next/link';
import {
  DatabaseZap,
  FileKey,
  KeyRound,
  Layers,
  Lock,
  ScrollText,
  ServerCog,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Section, SectionHeading, FeatureCard } from '@/components/marketing/sections';

export const metadata: Metadata = {
  title: 'الأمان والخصوصية',
  description:
    'عزل كامل بين الشركات عبر Row Level Security، صلاحيات على مستوى المستند، تشفير البيانات، وسجل تدقيق شامل. تعرّف على كيفية حماية معرفة AI لبيانات مؤسستك.',
};

const CONTROLS = [
  {
    icon: Layers,
    title: 'عزل المستأجرين',
    description:
      'كل صف في قاعدة البيانات مرتبط بشركته، وسياسات Row Level Security تمنع أي استعلام من تجاوز حدود شركة المستخدم — حتى لو أخطأ كود التطبيق.',
  },
  {
    icon: Lock,
    title: 'صلاحيات على مستوى المستند',
    description:
      'ثلاثة مستويات: الشركة كاملة، أقسام محددة، أو أدوار محددة. الفلترة تحدث داخل استعلام البحث نفسه قبل استرجاع أي محتوى.',
  },
  {
    icon: UserCheck,
    title: 'مصادقة وتفويض',
    description:
      'جلسات مُدارة عبر Supabase Auth مع تحقق من صحة الرمز على الخادم في كل طلب. الأدوار تُفحص على الخادم ولا يُعتمد على الواجهة.',
  },
  {
    icon: ServerCog,
    title: 'تحقق من جانب الخادم',
    description:
      'كل مدخل يمر بتحقق صارم على الخادم: نوع الملف، حجمه، وصلاحية المستخدم. إخفاء زر من الواجهة ليس إجراءً أمنيًا.',
  },
  {
    icon: KeyRound,
    title: 'إدارة المفاتيح',
    description:
      'مفاتيح الخدمة ومفاتيح مزوّدي الذكاء الاصطناعي تبقى على الخادم ولا تصل إلى المتصفح إطلاقًا، ولا تُحفظ في المستودع.',
  },
  {
    icon: FileKey,
    title: 'تخزين آمن للملفات',
    description:
      'الملفات في مخزن خاص لا يُقرأ إلا عبر روابط موقّعة مؤقتة، ومسار كل ملف يبدأ بمعرّف شركته وتحرسه سياسات التخزين.',
  },
  {
    icon: ScrollText,
    title: 'سجل تدقيق',
    description:
      'رفع مستند، تغيير صلاحية، تعديل دور، تعطيل حساب — كلها مسجّلة مع هوية المنفّذ ووقت التنفيذ.',
  },
  {
    icon: DatabaseZap,
    title: 'حدود ومعدلات',
    description:
      'حدود على معدل الطلبات وحصص شهرية للأسئلة، تحمي من إساءة الاستخدام ومن التكاليف غير المتوقعة.',
  },
  {
    icon: ShieldCheck,
    title: 'خصوصية المحادثات',
    description:
      'محادثة الموظف خاصة به. ما يراه المديرون إحصاءات مجمّعة فقط، لا نصوص محادثات أفراد.',
  },
];

export default function SecurityPage() {
  return (
    <>
      <Section className="pb-10">
        <SectionHeading
          eyebrow="الأمان"
          title="الأمان مبني في البنية، لا مضاف إليها"
          description="القرار المعماري الأهم في المنصة: العزل مطبَّق في قاعدة البيانات نفسها، لأن ما يعتمد على انضباط المطوّرين وحده ينكسر يومًا ما."
        />
      </Section>

      <Section className="pt-0">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CONTROLS.map((control) => (
            <FeatureCard key={control.title} {...control} />
          ))}
        </div>
      </Section>

      <Section muted>
        <div className="mx-auto max-w-3xl">
          <h2 className="text-xl font-semibold tracking-tight">كيف نمنع تسرّب البيانات عمليًا</h2>

          <div className="mt-8 space-y-6">
            {[
              {
                title: 'شركة «أ» لا ترى بيانات شركة «ب»',
                body: 'كل جدول يحمل معرّف الشركة، وكل سياسة قراءة تشترط تطابقه مع شركة المستخدم الحالي المستخرجة من رمز الجلسة داخل قاعدة البيانات. لا يمكن تمرير معرّف شركة من العميل، ولا يمكن لاستعلام أن يتجاوز هذا الشرط.',
              },
              {
                title: 'موظف المالية لا يرى مستندات الموارد البشرية',
                body: 'دالة البحث الدلالي تستخرج قسم المستخدم ودوره من قاعدة البيانات، وتفلتر المقاطع قبل حساب التشابه. المقطع الممنوع لا يصل إلى النموذج أصلًا، فلا يمكن أن يظهر في إجابة.',
              },
              {
                title: 'موظف لا يقرأ محادثات موظف آخر',
                body: 'المحادثات والرسائل مقيدة بمالكها، والمديرون يرون تجميعات إحصائية فقط: عدد الأسئلة، معدل الإجابة، والأسئلة المتكررة.',
              },
              {
                title: 'الاختبارات تتحقق من ذلك آليًا',
                body: 'مجموعة اختبارات مخصصة تتأكد من أن شركة «أ» لا تصل إلى بيانات شركة «ب»، وتُشغَّل مع كل تغيير في الكود.',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border bg-card p-6">
                <h3 className="text-base font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl rounded-xl border bg-card p-8">
          <h2 className="text-lg font-semibold">بياناتك ليست وقودًا للتدريب</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            مستندات شركتك تُستخدم حصريًا لتوليد إجابات لموظفيها. لا تُستخدم لتدريب أي
            نموذج، ولا تُشارك مع أي عميل آخر على المنصة.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            المستندات المؤرشفة تخرج من نطاق البحث فورًا، والحذف يزيل المستند ومقاطعه
            المفهرسة معًا.
          </p>
        </div>
      </Section>

      <Section muted>
        <div className="text-center">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            لديكم متطلبات امتثال محددة؟
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            نناقش بسرور تفاصيل الاستضافة، سياسات الاحتفاظ بالبيانات، ومتطلبات الأمن لدى
            فريقكم التقني.
          </p>
          <Button className="mt-7" asChild>
            <Link href="/contact">تواصل مع فريقنا</Link>
          </Button>
        </div>
      </Section>
    </>
  );
}
