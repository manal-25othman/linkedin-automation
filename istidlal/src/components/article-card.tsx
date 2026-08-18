import Link from "next/link";

import { ArticleCover } from "./article-cover";
import type { ArticleMeta } from "@/lib/articles";
import { categoryBySlug } from "@/config/categories";
import { formatDate } from "@/lib/format";

type Variant = "cover" | "plain" | "row";

/**
 * بطاقة المقال بثلاث هيئات:
 * - `cover`: غلاف فوق النصّ — هيئة الأرشيف والصفحة الرئيسية.
 * - `row`: صف أفقي مضغوط — الشريط الجانبي.
 * - `plain`: بلا غلاف — حيث تزاحم الصورة المحتوى.
 */
export function ArticleCard({
  article,
  variant = "cover",
  priority = false,
}: {
  article: ArticleMeta;
  variant?: Variant;
  priority?: boolean;
}) {
  const category = categoryBySlug.get(article.category);

  if (variant === "row") {
    return (
      <article className="group relative flex gap-3">
        <ArticleCover
          slug={article.slug}
          title={article.title}
          sizes="120px"
          className="w-28 shrink-0 rounded-lg border border-line"
        />
        <div className="min-w-0">
          <h3 className="font-display text-sm font-semibold leading-6 text-ink transition group-hover:text-signal">
            <Link href={`/articles/${article.slug}`} className="after:absolute after:inset-0">
              {article.title}
            </Link>
          </h3>
          <p className="mt-1 text-[0.7rem] text-ink-faint numerals-latn">
            {formatDate(article.published)} · {article.readingMinutes} دقائق
          </p>
        </div>
      </article>
    );
  }

  return (
    <article className="lift group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface hover:border-signal-line hover:shadow-[var(--shadow-card)]">
      {variant === "cover" && (
        <ArticleCover slug={article.slug} title={article.title} priority={priority} />
      )}

      <div className="flex flex-1 flex-col p-6">
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

        <h3 className="mt-4 font-display text-xl font-bold leading-snug text-ink">
          <Link href={`/articles/${article.slug}`} className="after:absolute after:inset-0">
            {article.title}
          </Link>
        </h3>

        <p className="mt-3 line-clamp-3 text-[0.95rem] leading-7 text-ink-muted">
          {article.description}
        </p>

        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-signal">
          اقرأ المقال
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="transition group-hover:-translate-x-1"
          >
            <path
              d="M19 12H5m0 0 6-6m-6 6 6 6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </article>
  );
}

/** المقال المتصدّر: غلاف كبير إلى جانب النصّ. */
export function FeatureCard({ article }: { article: ArticleMeta }) {
  const category = categoryBySlug.get(article.category);

  return (
    <article className="group relative grid items-stretch gap-6 overflow-hidden rounded-2xl border border-line bg-surface md:grid-cols-2 md:gap-0">
      <ArticleCover
        slug={article.slug}
        title={article.title}
        priority
        sizes="(max-width: 768px) 100vw, 50vw"
        // الغلاف زخرفي لا يحمل نصًّا حرجًا، فالقصّ عند التمدّد مقبول
        className="md:absolute md:inset-y-0 md:left-0 md:w-1/2 md:aspect-auto"
      />
      <div className="flex flex-col justify-center p-6 md:p-8">
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

        <h2 className="mt-4 font-display text-2xl font-bold leading-snug text-ink md:text-[1.9rem]">
          <Link href={`/articles/${article.slug}`} className="after:absolute after:inset-0">
            {article.title}
          </Link>
        </h2>

        <p className="mt-4 line-clamp-4 leading-8 text-ink-muted">{article.description}</p>

        <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-signal">
          اقرأ المقال كاملًا
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M19 12H5m0 0 6-6m-6 6 6 6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </article>
  );
}
