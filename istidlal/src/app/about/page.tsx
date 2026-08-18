import type { Metadata } from "next";
import Link from "next/link";

import { JsonLd } from "@/components/json-ld";
import { PageShell } from "@/components/page-shell";
import { absoluteUrl, siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "عن استدلال",
  description:
    "من نحن، ولماذا تخصّصنا في هندسة أنظمة الذكاء الاصطناعي التطبيقية، وكيف نتحقّق مما ننشره.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  const person = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: siteConfig.author.name,
    jobTitle: siteConfig.author.role,
    description: siteConfig.author.bio,
    url: absoluteUrl("/about"),
    email: siteConfig.email,
    worksFor: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
  };

  return (
    <>
      <PageShell
        title="عن استدلال"
        lead="مدونة عربية واحدة الموضوع: كيف تبني نظامًا مبنيًّا على نموذج لغوي يصمد في الإنتاج."
        crumbs={[{ href: "/about", label: "عن استدلال" }]}
      >
        <h2>لماذا وُجدت</h2>
        <p>
          المحتوى العربي عن الذكاء الاصطناعي وفير في الأخبار والانطباعات، وشحيح في الهندسة: كيف
          تُقطّع مستندًا عربيًّا دون كسر معناه، كيف تقيس هلوسة نظامك برقم، كم تكلّف كل ألف طلب فعلًا،
          وماذا يحدث حين يزرع أحدهم تعليمة خبيثة داخل صفحة يقرأها وكيلك. هذه الأسئلة يجيب عنها
          مهندسون بالإنجليزية، ونادرًا ما يجيب عنها أحد بالعربية بعمق كافٍ. استدلال يسدّ هذه الفجوة
          تحديدًا.
        </p>

        <h2>ما الذي نكتب عنه — وما لا نكتب</h2>
        <p>
          نطاقنا ستة مسارات: الاسترجاع المعزّز (RAG)، الوكلاء والأدوات، التقييم والقياس، الاستدلال
          والتكلفة، أمن تطبيقات النماذج اللغوية، والحوكمة والامتثال.
        </p>
        <p>
          ولا نكتب: أخبار الشركات وجولات التمويل، قوائم «أفضل ١٠ أدوات»، أدوات الترفيه، تنبّؤات عن
          الذكاء العام، ولا وعودًا بالربح السريع. التخصص يعني رفض كل ما لا يخدم القارئ المستهدف.
        </p>

        <h2>من يكتب</h2>
        <p>
          <strong>{siteConfig.author.name}</strong> — {siteConfig.author.role}. {siteConfig.author.bio}
        </p>

        <h2>كيف نتحقّق</h2>
        <ul>
          <li>كل ادعاء غير بديهي مسنود إلى ورقة بحثية أو توثيق رسمي أو معيار منشور.</li>
          <li>كل كود منشور شُغّل فعلًا، ومعه إصدار المكتبة الذي جُرّب عليه.</li>
          <li>كل مقارنة تذكر البيانات وطريقة القياس حتى تُعاد بنفسك.</li>
          <li>كل تحديث جوهري يُسجَّل بتاريخه أسفل المقال.</li>
        </ul>
        <p>
          التفاصيل الكاملة في <Link href="/editorial-policy">سياسة التحرير</Link>، وسياستنا في
          الإعلانات والإفصاح في <Link href="/advertising-policy">سياسة الإعلانات</Link>.
        </p>

        <h2>تواصل معنا</h2>
        <p>
          للتصحيحات والمقترحات والتعاون:{" "}
          <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a> — أو عبر{" "}
          <Link href="/contact">صفحة التواصل</Link>. نردّ عادةً خلال ثلاثة أيام عمل.
        </p>
      </PageShell>
      <JsonLd data={person} />
    </>
  );
}
