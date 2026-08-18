import Link from "next/link";

import type { ArticleMeta } from "@/lib/articles";
import { categoryBySlug } from "@/config/categories";
import { formatDate } from "@/lib/format";

/** بطاقة المقال في الأرشيف والصفحة الرئيسية. */
export function ArticleCard({ article, featured = false }: { article: ArticleMeta; featured?: boolean }) {
  const category = categoryBySlug.get(article.category);

  return (
    <article
      className={`lift group relative flex flex-col rounded-2xl border border-line bg-surface p-6 hover:border-signal-line hover:shadow-[var(--shadow-card)] ${
        featured ? "md:p-8" : ""
      }`}
    >
      <div className="flex items-center gap-3 text-xs text-ink-faint numerals-latn">
        {category && (
          <span className="rounded-md bg-signal-soft px-2 py-1 font-medium text-signal">
            {category.short}
          </span>
        )}
        <time dateTime={article.published}>{formatDate(article.published)}</time>
        <span aria-hidden="true">·</span>
        <span>{article.readingMinutes} دقائق قراءة</span>
      </div>

      <h3
        className={`mt-4 font-display font-bold text-ink ${
          featured ? "text-2xl leading-snug md:text-[1.7rem]" : "text-xl leading-snug"
        }`}
      >
        <Link href={`/articles/${article.slug}`} className="after:absolute after:inset-0">
          {article.title}
        </Link>
      </h3>

      <p className="mt-3 line-clamp-3 text-[0.95rem] leading-7 text-ink-muted">
        {article.description}
      </p>

      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-signal">
        اقرأ المقال
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="transition group-hover:-translate-x-1">
          <path d="M19 12H5m0 0 6-6m-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </article>
  );
}
