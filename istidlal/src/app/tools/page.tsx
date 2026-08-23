import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { ToolsExplorer } from "@/components/tools-explorer";
import { absoluteUrl } from "@/config/site";
import { getToolIndex } from "@/lib/tools";

export const metadata: Metadata = {
  title: "دليل أدوات الذكاء الاصطناعي",
  description:
    "دليل مختصر لأدوات بناء أنظمة الذكاء الاصطناعي: قواعد المتّجهات، أطر الاسترجاع والوكلاء، أدوات التقييم والرصد، محرّكات الاستدلال، وحواجز الأمن — مع حدود كل أداة لا مزاياها فقط.",
  alternates: { canonical: "/tools" },
};

export default function ToolsPage() {
  const tools = getToolIndex();

  const collection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "دليل أدوات الذكاء الاصطناعي",
    description: metadata.description,
    url: absoluteUrl("/tools"),
    inLanguage: "ar",
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <JsonLd data={collection} />
      <Breadcrumbs items={[{ href: "/tools", label: "الأدوات" }]} />

      <header className="mt-6 max-w-2xl">
        <h1 className="font-display text-3xl font-bold text-ink md:text-4xl">
          دليل الأدوات
        </h1>
        <p className="mt-4 text-lg leading-9 text-ink-muted">
          ليس جردًا لكل ما في السوق. هذه الأدوات التي تظهر في مقالات استدلال، ولكل مدخل سؤالان:
          متى تناسبك، ومتى لا تناسبك.
        </p>
        <p className="mt-3 text-sm leading-7 text-ink-faint">
          لا نذكر أسعارًا لأنها تتغيّر أسرع من تحديث الصفحة؛ نذكر الترخيص وطريقة التشغيل، وهما
          أثبت. تحقّق من السعر في الموقع الرسمي لكل أداة.
        </p>
      </header>

      <ToolsExplorer tools={tools} />
    </div>
  );
}
