import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleCard } from "@/components/article-card";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { categories, categoryBySlug } from "@/config/categories";
import { absoluteUrl, siteConfig } from "@/config/site";
import { getArticlesByCategory } from "@/lib/articles";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = categoryBySlug.get(slug);
  if (!category) return { title: "تصنيف غير موجود" };

  return {
    title: category.name,
    description: category.description,
    alternates: { canonical: `/categories/${category.slug}` },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const category = categoryBySlug.get(slug);
  if (!category) notFound();

  const articles = getArticlesByCategory(category.slug);

  const collection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: category.name,
    description: category.description,
    inLanguage: "ar",
    url: absoluteUrl(`/categories/${category.slug}`),
    isPartOf: { "@type": "WebSite", name: siteConfig.name, url: siteConfig.url },
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Breadcrumbs
        items={[
          { href: "/categories", label: "التصنيفات" },
          { href: `/categories/${category.slug}`, label: category.name },
        ]}
      />

      <header className="mt-6 max-w-2xl">
        <h1 className="font-display text-3xl font-bold text-ink md:text-4xl">{category.name}</h1>
        <p className="mt-4 text-lg leading-9 text-ink-muted">{category.description}</p>
        <div className="mt-5 flex flex-wrap gap-1.5">
          {category.subtopics.map((topic) => (
            <span key={topic} className="rounded-md bg-surface-soft px-2.5 py-1 text-xs text-ink-faint">
              {topic}
            </span>
          ))}
        </div>
      </header>

      {articles.length > 0 ? (
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      ) : (
        <p className="mt-10 rounded-2xl border border-dashed border-line p-8 text-center text-sm text-ink-muted">
          لا مقالات منشورة في هذا التصنيف بعد — وهو التالي في تقويم النشر.
        </p>
      )}

      <JsonLd data={collection} />
    </div>
  );
}
