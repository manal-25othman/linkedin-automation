import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { categories } from "@/config/categories";
import { getArticlesByCategory } from "@/lib/articles";

export const metadata: Metadata = {
  title: "التصنيفات",
  description:
    "ستة مسارات هندسية داخل تخصص واحد: الاسترجاع المعزّز، الوكلاء والأدوات، التقييم، الاستدلال والتكلفة، الأمن، والحوكمة.",
  alternates: { canonical: "/categories" },
};

export default function CategoriesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Breadcrumbs items={[{ href: "/categories", label: "التصنيفات" }]} />

      <header className="mt-6 max-w-2xl">
        <h1 className="font-display text-3xl font-bold text-ink md:text-4xl">التصنيفات</h1>
        <p className="mt-4 text-lg leading-9 text-ink-muted">
          نطاق استدلال ضيّق عن قصد: ما يحتاجه المهندس لتشغيل نظام لغوي في الإنتاج. لا أخبار، ولا
          قوائم أدوات، ولا تنبّؤات.
        </p>
      </header>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {categories.map((category) => {
          const count = getArticlesByCategory(category.slug).length;
          return (
            <Link
              key={category.slug}
              href={`/categories/${category.slug}`}
              className="group rounded-2xl border border-line bg-surface p-7 transition hover:border-signal-line hover:shadow-[var(--shadow-card)]"
            >
              <div className="flex items-start justify-between gap-4">
                <h2 className="font-display text-xl font-bold text-ink group-hover:text-signal">
                  {category.name}
                </h2>
                <span className="shrink-0 rounded-md bg-surface-soft px-2 py-1 text-xs text-ink-faint numerals-latn">
                  {count} مقال
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-ink-muted">{category.description}</p>
              <div className="mt-5 flex flex-wrap gap-1.5">
                {category.subtopics.map((topic) => (
                  <span key={topic} className="rounded-md bg-surface-soft px-2 py-1 text-[0.7rem] text-ink-faint">
                    {topic}
                  </span>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
