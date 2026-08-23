import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { absoluteUrl, siteConfig } from "@/config/site";
import {
  hostingLabels,
  licenseLabels,
  toolCategoryBySlug,
} from "@/config/tool-categories";
import { getAllArticles } from "@/lib/articles";
import { formatDate } from "@/lib/format";
import { getRelatedTools, getTool, getToolSlugs } from "@/lib/tools";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getToolSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = await getTool(slug);
  if (!tool) return { title: "الأداة غير موجودة" };

  return {
    title: `${tool.name} (${tool.nameLatin})`,
    description: tool.description,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: {
      type: "article",
      url: absoluteUrl(`/tools/${tool.slug}`),
      title: `${tool.name} — دليل أدوات استدلال`,
      description: tool.description,
    },
  };
}

export default async function ToolPage({ params }: PageProps) {
  const { slug } = await params;
  const tool = await getTool(slug);
  if (!tool) notFound();

  const category = toolCategoryBySlug.get(tool.category);
  const related = getRelatedTools(tool.slug, 3);

  // الربط الداخلي محسوب: نعرض فقط المقالات الموجودة والمنشورة فعلًا.
  const published = getAllArticles();
  const articles = tool.relatedArticles
    .map((articleSlug) => published.find((article) => article.slug === articleSlug))
    .filter((article): article is NonNullable<typeof article> => Boolean(article));

  /**
   * بيانات مهيكلة بما نعرفه فقط: اسم، وصف، رابط، تصنيف، ترخيص.
   * لا تقييمات ولا أسعار ولا عدد مستخدمين — لا نملك هذه الأرقام فلا نُصرّح بها.
   */
  const softwareApplication = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: tool.nameLatin,
    alternateName: tool.name,
    description: tool.description,
    url: tool.website,
    applicationCategory: "DeveloperApplication",
    inLanguage: "ar",
    ...(tool.license === "open-source" ? { license: tool.repo ?? tool.website } : {}),
  };

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "الرئيسية", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "الأدوات", item: absoluteUrl("/tools") },
      {
        "@type": "ListItem",
        position: 3,
        name: tool.name,
        item: absoluteUrl(`/tools/${tool.slug}`),
      },
    ],
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <JsonLd data={softwareApplication} />
      <JsonLd data={breadcrumbs} />

      <Breadcrumbs
        items={[
          { href: "/tools", label: "الأدوات" },
          { href: `/tools/${tool.slug}`, label: tool.name },
        ]}
      />

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          {category && (
            <Link
              href="/tools"
              className="rounded-md bg-surface-soft px-2 py-1 text-xs text-ink-muted hover:text-signal"
            >
              {category.name}
            </Link>
          )}
          <span className="rounded-md bg-surface-soft px-2 py-1 text-xs text-ink-faint">
            {licenseLabels[tool.license]}
          </span>
          <span className="rounded-md bg-surface-soft px-2 py-1 text-xs text-ink-faint">
            {hostingLabels[tool.hosting]}
          </span>
        </div>

        <h1 className="mt-4 font-display text-3xl font-bold text-ink md:text-4xl">{tool.name}</h1>
        <p dir="ltr" className="mt-1 text-sm text-ink-faint">
          {tool.nameLatin}
        </p>
        <p className="mt-4 text-lg leading-9 text-ink-muted">{tool.description}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={tool.website}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="rounded-xl bg-signal px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-signal-hover"
          >
            الموقع الرسمي ↗
          </a>
          {tool.docs && (
            <a
              href={tool.docs}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-signal-line hover:text-signal"
            >
              التوثيق ↗
            </a>
          )}
          {tool.repo && (
            <a
              href={tool.repo}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-signal-line hover:text-signal"
            >
              المستودع ↗
            </a>
          )}
          {/* لا تظهر هذه البطاقة إلا إذا وُجد رابط مقطع فعلي. */}
          {tool.tiktok && (
            <a
              href={tool.tiktok}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-signal-line bg-signal-soft px-5 py-2.5 text-sm font-semibold text-signal transition hover:bg-signal hover:text-white"
            >
              شاهد التغطية على تيك توك ↗
            </a>
          )}
        </div>
      </header>

      <div className="prose mt-10" dangerouslySetInnerHTML={{ __html: tool.html }} />

      <section className="mt-10 grid gap-5 sm:grid-cols-2">
        <PointList title="متى تناسبك" items={tool.goodFor} tone="signal" />
        <PointList title="متى لا تناسبك" items={tool.limits} tone="amber" />
      </section>

      {articles.length > 0 && (
        <section className="mt-10 rounded-2xl border border-line bg-surface p-6">
          <h2 className="font-display text-lg font-bold text-ink">من مقالات استدلال</h2>
          <ul className="mt-4 flex flex-col divide-y divide-line">
            {articles.map((article) => (
              <li key={article.slug}>
                <Link
                  href={`/articles/${article.slug}`}
                  className="block py-3 text-sm text-ink-muted transition hover:text-signal"
                >
                  {article.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-lg font-bold text-ink">أدوات في التصنيف نفسه</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-3">
            {related.map((item) => (
              <li key={item.slug}>
                <Link
                  href={`/tools/${item.slug}`}
                  className="lift block h-full rounded-xl border border-line bg-surface p-4 text-sm hover:border-signal-line"
                >
                  <span className="font-display font-bold text-ink">{item.name}</span>
                  <span className="mt-1 block text-xs leading-6 text-ink-faint">
                    {item.description}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-10 border-t border-line pt-5 text-xs leading-6 text-ink-faint numerals-latn">
        آخر مراجعة لهذا المدخل: {formatDate(tool.updated ?? tool.published)}. المعلومات وصفية،
        وتفاصيل الترخيص والتسعير تتغيّر — المرجع في ذلك الموقع الرسمي. {siteConfig.name} لا تتقاضى
        مقابلًا عن إدراج أداة في هذا الدليل.
      </p>
    </div>
  );
}

function PointList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "signal" | "amber";
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="font-display text-base font-bold text-ink">{title}</h2>
      <ul className="mt-4 flex flex-col gap-3">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-sm leading-7 text-ink-muted">
            <span
              aria-hidden="true"
              className={`mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                tone === "signal" ? "bg-signal" : "bg-amber"
              }`}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
