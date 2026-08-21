import Link from "next/link";

import { ArticleCard, FeatureCard } from "./article-card";
import { Breadcrumbs } from "./breadcrumbs";
import { NewsletterForm } from "./newsletter-form";
import { categories } from "@/config/categories";
import type { ArticleMeta } from "@/lib/articles";

export const PAGE_SIZE = 6;

export function pageHref(page: number): string {
  return page <= 1 ? "/articles" : `/articles/page/${page}`;
}

/**
 * أرشيف المقالات بهيئة المجلّة: مقال متصدّر بغلاف كبير، ثم شبكة بطاقات
 * مصوّرة، وشريط جانبي، وترقيم صفحات. الصفحة الأولى وحدها تعرض المتصدّر.
 */
export function ArchiveView({
  articles,
  page,
  totalPages,
  counts,
  popular,
}: {
  articles: ArticleMeta[];
  page: number;
  totalPages: number;
  counts: Record<string, number>;
  popular: ArticleMeta[];
}) {
  const [lead, ...rest] = page === 1 ? articles : [];
  const grid = page === 1 ? rest : articles;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Breadcrumbs
        items={
          page === 1
            ? [{ href: "/articles", label: "المقالات" }]
            : [
                { href: "/articles", label: "المقالات" },
                { href: pageHref(page), label: `صفحة ${page}` },
              ]
        }
      />

      <header className="mt-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink md:text-4xl">المقالات</h1>
          <p className="mt-3 max-w-xl leading-8 text-ink-muted">
            كل ما نشرناه في هندسة أنظمة الذكاء الاصطناعي التطبيقية — مرتّبًا من الأحدث، وكل مقال
            مسنود إلى مصدر أوّلي أو قياس منشور.
          </p>
        </div>
        <p className="text-sm text-ink-faint numerals-latn">
          صفحة {page} من {totalPages}
        </p>
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="min-w-0">
          {lead && (
            <div className="mb-8">
              <FeatureCard article={lead} />
            </div>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            {grid.map((article, index) => (
              <ArticleCard key={article.slug} article={article} priority={page > 1 && index < 2} />
            ))}
          </div>

          <Pagination page={page} totalPages={totalPages} />
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-24">
          <SidebarBlock title="التصنيفات">
            <ul className="flex flex-col divide-y divide-line">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/categories/${category.slug}`}
                    className="flex items-center justify-between py-2.5 text-sm text-ink-soft transition hover:text-signal"
                  >
                    <span>{category.name}</span>
                    <span className="text-xs text-ink-faint numerals-latn">
                      {counts[category.slug] ?? 0}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </SidebarBlock>

          <SidebarBlock title="مقالات الركيزة">
            <div className="flex flex-col gap-4">
              {popular.map((article) => (
                <ArticleCard key={article.slug} article={article} variant="row" />
              ))}
            </div>
          </SidebarBlock>

          <SidebarBlock title="النشرة الأسبوعية">
            <p className="mb-3 text-xs leading-6 text-ink-muted">
              ثلاثة أشياء مفيدة كل أسبوع: ورقة مشروحة، وقياس عملي، وخطأ شائع في الإنتاج.
            </p>
            <NewsletterForm compact />
          </SidebarBlock>
        </aside>
      </div>
    </div>
  );
}

function SidebarBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="mb-3 border-b border-line pb-3 font-display text-sm font-bold text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <nav aria-label="ترقيم الصفحات" className="mt-10 flex items-center justify-center gap-2">
      {page > 1 && (
        <Link
          href={pageHref(page - 1)}
          rel="prev"
          className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:border-signal-line hover:text-signal"
        >
          السابق
        </Link>
      )}

      {pages.map((number) => (
        <Link
          key={number}
          href={pageHref(number)}
          aria-current={number === page ? "page" : undefined}
          className={`grid h-10 w-10 place-items-center rounded-xl border text-sm font-medium numerals-latn transition ${
            number === page
              ? "border-signal bg-signal text-white"
              : "border-line bg-surface text-ink-soft hover:border-signal-line hover:text-signal"
          }`}
        >
          {number}
        </Link>
      ))}

      {page < totalPages && (
        <Link
          href={pageHref(page + 1)}
          rel="next"
          className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:border-signal-line hover:text-signal"
        >
          التالي
        </Link>
      )}
    </nav>
  );
}
