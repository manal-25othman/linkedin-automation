import type { Metadata } from "next";
import Link from "next/link";

import { ArticleCard } from "@/components/article-card";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { categories } from "@/config/categories";
import { getAllArticles, getAllTags } from "@/lib/articles";

export const metadata: Metadata = {
  title: "كل المقالات",
  description:
    "أرشيف مقالات استدلال في هندسة أنظمة الذكاء الاصطناعي التطبيقية: الاسترجاع المعزّز، الوكلاء، التقييم، التكلفة، الأمن، والحوكمة.",
  alternates: { canonical: "/articles" },
};

export default function ArticlesPage() {
  const articles = getAllArticles();
  const tags = getAllTags().slice(0, 12);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Breadcrumbs items={[{ href: "/articles", label: "المقالات" }]} />

      <header className="mt-6 max-w-2xl">
        <h1 className="font-display text-3xl font-bold text-ink md:text-4xl">كل المقالات</h1>
        <p className="mt-4 text-lg leading-9 text-ink-muted">
          <span className="numerals-latn">{articles.length}</span> مقالًا تقنيًّا، كل واحد منها
          مسنود إلى مصدر أوّلي أو قياس منشور. مرتّبة من الأحدث إلى الأقدم.
        </p>
      </header>

      <div className="mt-8 flex flex-wrap gap-2">
        {categories.map((category) => (
          <Link
            key={category.slug}
            href={`/categories/${category.slug}`}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink-soft transition hover:border-signal-line hover:text-signal"
          >
            {category.short}
          </Link>
        ))}
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <ArticleCard key={article.slug} article={article} />
        ))}
      </div>

      <section className="mt-16 border-t border-line pt-8">
        <h2 className="font-display text-lg font-bold text-ink">وسوم متكرّرة</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map(({ tag, count }) => (
            <Link
              key={tag}
              href={`/tags/${encodeURIComponent(tag)}`}
              className="rounded-lg bg-surface-soft px-3 py-1.5 text-xs text-ink-muted transition hover:text-signal"
            >
              #{tag} <span className="text-ink-faint numerals-latn">({count})</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
