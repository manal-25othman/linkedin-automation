import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdSlot } from "@/components/ad-slot";
import { ArticleCard } from "@/components/article-card";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { JsonLd } from "@/components/json-ld";
import { NewsletterCta } from "@/components/newsletter-cta";
import { TableOfContents } from "@/components/table-of-contents";
import { categoryBySlug } from "@/config/categories";
import { absoluteUrl, siteConfig } from "@/config/site";
import { getArticle, getArticleSlugs, getRelatedArticles } from "@/lib/articles";
import { formatDate } from "@/lib/format";
import { getToolsForArticle } from "@/lib/tools";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getArticleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "المقال غير موجود" };

  const url = absoluteUrl(`/articles/${article.slug}`);

  return {
    title: article.seoTitle ?? article.title,
    description: article.description,
    alternates: { canonical: `/articles/${article.slug}` },
    openGraph: {
      type: "article",
      url,
      title: article.title,
      description: article.description,
      publishedTime: article.published,
      modifiedTime: article.updated ?? article.published,
      authors: [siteConfig.author.name],
      tags: article.tags,
    },
    twitter: { card: "summary_large_image", title: article.title, description: article.description },
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const category = categoryBySlug.get(article.category);
  const related = getRelatedArticles(article.slug, 3);
  const tools = getToolsForArticle(article.slug);
  const url = absoluteUrl(`/articles/${article.slug}`);

  const blogPosting = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description: article.description,
    inLanguage: "ar",
    datePublished: article.published,
    dateModified: article.updated ?? article.published,
    wordCount: article.readingMinutes * 180,
    keywords: article.tags.join("، "),
    articleSection: category?.name,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: {
      "@type": "Person",
      name: siteConfig.author.name,
      jobTitle: siteConfig.author.role,
      url: absoluteUrl("/about"),
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      logo: { "@type": "ImageObject", url: absoluteUrl("/icon.svg") },
    },
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "الرئيسية", item: siteConfig.url },
      { "@type": "ListItem", position: 2, name: "المقالات", item: absoluteUrl("/articles") },
      ...(category
        ? [
            {
              "@type": "ListItem",
              position: 3,
              name: category.name,
              item: absoluteUrl(`/categories/${category.slug}`),
            },
          ]
        : []),
      { "@type": "ListItem", position: category ? 4 : 3, name: article.title, item: url },
    ],
  };

  const faqSchema =
    article.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: article.faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }
      : null;

  return (
    <article className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Breadcrumbs
        items={[
          { href: "/articles", label: "المقالات" },
          ...(category ? [{ href: `/categories/${category.slug}`, label: category.name }] : []),
          { href: `/articles/${article.slug}`, label: article.title },
        ]}
      />

      <header className="mt-6 max-w-3xl">
        {category && (
          <Link
            href={`/categories/${category.slug}`}
            className="inline-block rounded-md bg-signal-soft px-2.5 py-1 text-xs font-medium text-signal"
          >
            {category.name}
          </Link>
        )}
        <h1 className="mt-4 font-display text-3xl font-bold leading-[1.4] text-ink md:text-[2.6rem]">
          {article.title}
        </h1>
        <p className="mt-5 text-lg leading-9 text-ink-muted">{article.description}</p>

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-line py-4 text-sm text-ink-muted numerals-latn">
          <span className="font-medium text-ink">{siteConfig.author.name}</span>
          <span aria-hidden="true">·</span>
          <span>
            نُشر <time dateTime={article.published}>{formatDate(article.published)}</time>
          </span>
          {article.updated && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-signal">
                حُدّث <time dateTime={article.updated}>{formatDate(article.updated)}</time>
              </span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span>{article.readingMinutes} دقائق قراءة</span>
        </div>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <div className="min-w-0 max-w-3xl">
          {article.takeaways.length > 0 && (
            <aside className="rounded-2xl border border-signal-line bg-signal-soft p-6">
              <h2 className="font-display text-base font-bold text-ink">الخلاصة قبل القراءة</h2>
              <ul className="mt-3 flex flex-col gap-2.5 text-[0.95rem] leading-7 text-ink-soft">
                {article.takeaways.map((point) => (
                  <li key={point} className="flex gap-2.5">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </aside>
          )}

          <div className="prose mt-10" dangerouslySetInnerHTML={{ __html: article.html }} />

          {/* موضع إعلاني بعد المتن — قبل المراجع لا داخل القراءة */}
          <AdSlot minHeight={250} label="مساحة إعلانية — نهاية المقال" />

          <div className="mt-10 flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <Link
                key={tag}
                href={`/tags/${encodeURIComponent(tag)}`}
                className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink-muted transition hover:border-signal-line hover:text-signal"
              >
                #{tag}
              </Link>
            ))}
          </div>

          <aside className="mt-10 rounded-2xl border border-line bg-surface p-6">
            <h2 className="font-display text-base font-bold text-ink">عن الكاتبة</h2>
            <p className="mt-2 text-sm leading-7 text-ink-muted">
              <span className="font-medium text-ink">{siteConfig.author.name}</span> —{" "}
              {siteConfig.author.role}. {siteConfig.author.bio}
            </p>
            <Link href="/about" className="mt-3 inline-block text-sm font-medium text-signal hover:underline">
              اقرأ المزيد عن استدلال ←
            </Link>
          </aside>
        </div>

        <aside className="flex flex-col gap-6">
          <TableOfContents headings={article.headings} />
          <AdSlot minHeight={600} label="مساحة إعلانية جانبية" />
        </aside>
      </div>

      {tools.length > 0 && (
        <section className="mt-16">
          <h2 className="border-b border-line pb-4 font-display text-2xl font-bold text-ink">
            أدوات مذكورة في هذا المقال
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-3">
            {tools.map((tool) => (
              <li key={tool.slug}>
                <Link
                  href={`/tools/${tool.slug}`}
                  className="lift block h-full rounded-xl border border-line bg-surface p-4 hover:border-signal-line"
                >
                  <span className="font-display font-bold text-ink">{tool.name}</span>
                  <span dir="ltr" className="mt-0.5 block text-[0.7rem] text-ink-faint">
                    {tool.nameLatin}
                  </span>
                  <span className="mt-2 block text-xs leading-6 text-ink-muted">
                    {tool.description}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="border-b border-line pb-4 font-display text-2xl font-bold text-ink">
            اقرأ بعده
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {related.map((item) => (
              <ArticleCard key={item.slug} article={item} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-16">
        <NewsletterCta />
      </div>

      <JsonLd data={blogPosting} />
      <JsonLd data={breadcrumb} />
      {faqSchema && <JsonLd data={faqSchema} />}
    </article>
  );
}
