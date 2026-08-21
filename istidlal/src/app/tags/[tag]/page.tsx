import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleCard } from "@/components/article-card";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { getAllTags, getArticlesByTag } from "@/lib/articles";

type PageProps = { params: Promise<{ tag: string }> };

export function generateStaticParams() {
  return getAllTags().map(({ tag }) => ({ tag: encodeURIComponent(tag) }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tag } = await params;
  const label = decodeURIComponent(tag);
  return {
    title: `وسم: ${label}`,
    description: `كل مقالات استدلال الموسومة بـ«${label}».`,
    alternates: { canonical: `/tags/${tag}` },
    // أرشيف الوسوم رقيق المحتوى — يُتبَع ولا يُفهرَس.
    robots: { index: false, follow: true },
  };
}

export default async function TagPage({ params }: PageProps) {
  const { tag } = await params;
  const label = decodeURIComponent(tag);
  const articles = getArticlesByTag(label);
  if (articles.length === 0) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Breadcrumbs
        items={[
          { href: "/articles", label: "المقالات" },
          { href: `/tags/${tag}`, label: `#${label}` },
        ]}
      />
      <h1 className="mt-6 font-display text-3xl font-bold text-ink">
        وسم: <span className="text-signal">#{label}</span>
      </h1>
      <p className="mt-3 text-ink-muted numerals-latn">{articles.length} مقالات</p>

      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <ArticleCard key={article.slug} article={article} />
        ))}
      </div>
    </div>
  );
}
