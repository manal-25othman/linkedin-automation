import Link from "next/link";

import { ArticleCard } from "@/components/article-card";
import { NewsletterCta } from "@/components/newsletter-cta";
import { categories } from "@/config/categories";
import { siteConfig } from "@/config/site";
import { getAllArticles, getArticlesByCategory, getFeaturedArticles } from "@/lib/articles";

export default function HomePage() {
  const all = getAllArticles();
  const featured = getFeaturedArticles(2);
  const featuredSlugs = new Set(featured.map((article) => article.slug));
  const latest = all.filter((article) => !featuredSlugs.has(article.slug)).slice(0, 6);

  return (
    <>
      {/* ---------- الواجهة ---------- */}
      <section className="relative overflow-hidden border-b border-line bg-surface">
        <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-signal-line bg-signal-soft px-3 py-1 text-xs font-medium text-signal">
                <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden="true" />
                مدونة عربية متخصصة — بلا أخبار وبلا مبالغات
              </p>

              <h1 className="mt-6 font-display text-[2.1rem] font-bold leading-[1.45] text-ink text-balance md:text-[2.7rem]">
                هندسة أنظمة الذكاء الاصطناعي
                <span className="block text-signal">بالقياس لا بالانطباع.</span>
              </h1>

              <p className="mt-6 max-w-xl text-[1.05rem] leading-9 text-ink-muted">
                كل ما تحتاجه لنقل نظام مبنيّ على نموذج لغوي من دفتر التجارب إلى الإنتاج: الاسترجاع
                المعزّز، الوكلاء، التقييم، اقتصاد الاستدلال، والأمن — بمراجع أوّلية وكود يعمل.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/articles"
                  className="rounded-xl bg-signal px-6 py-3 text-sm font-semibold text-white transition hover:bg-signal-hover"
                >
                  ابدأ من المقالات
                </Link>
                <Link
                  href="/newsletter"
                  className="rounded-xl border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink transition hover:border-signal-line hover:text-signal"
                >
                  اشترك في النشرة
                </Link>
              </div>

              <dl className="mt-10 grid gap-6 border-t border-line pt-7 sm:grid-cols-3">
                <Stat value={`${all.length}`} label="مقالًا تقنيًّا منشورًا" />
                <Stat value="6" label="تصنيفات هندسية" />
                <Stat value="100%" label="ادعاءات مسنودة إلى مصدر" />
              </dl>
            </div>

            {/* لوحة النطاق: تعطي الواجهة ثِقلًا بصريًّا وتقول ما يغطّيه الموقع في نظرة */}
            <aside className="rounded-2xl border border-line bg-bg p-6 shadow-[var(--shadow-card)] lg:p-7">
              <p className="text-xs font-medium tracking-widest text-ink-faint">نطاق التغطية</p>
              <ul className="mt-4 flex flex-col divide-y divide-line">
                {categories.map((category, index) => (
                  <li key={category.slug}>
                    <Link
                      href={`/categories/${category.slug}`}
                      className="group flex items-center justify-between gap-3 py-3 text-sm"
                    >
                      <span className="flex items-center gap-3">
                        <span className="w-5 text-xs text-ink-faint numerals-latn">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="font-medium text-ink transition group-hover:text-signal">
                          {category.name}
                        </span>
                      </span>
                      <span className="text-xs text-ink-faint numerals-latn">
                        {getArticlesByCategory(category.slug).length}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t border-line pt-4 text-xs leading-6 text-ink-muted">
                لا أخبار شركات، ولا قوائم أدوات، ولا تنبّؤات — ما يخدم مهندسًا يبني نظامًا حقيقيًّا
                هذا الأسبوع فقط.
              </p>
            </aside>
          </div>
        </div>
      </section>

      {/* ---------- المميّزة ---------- */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <SectionHead title="مقالات الركيزة" href="/articles" linkLabel="كل المقالات" />
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {featured.map((article) => (
              <ArticleCard key={article.slug} article={article} featured />
            ))}
          </div>
        </section>
      )}

      {/* ---------- التصنيفات ---------- */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <SectionHead title="ستة مسارات، تخصّص واحد" href="/categories" linkLabel="فهرس التصنيفات" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`/categories/${category.slug}`}
                className="lift group rounded-2xl border border-line bg-bg p-6 hover:border-signal-line hover:shadow-[var(--shadow-card)]"
              >
                <h3 className="font-display text-lg font-bold text-ink group-hover:text-signal">
                  {category.name}
                </h3>
                <p className="mt-2 text-sm leading-7 text-ink-muted">{category.description}</p>
                <p className="mt-4 flex flex-wrap gap-1.5 text-[0.7rem] text-ink-faint">
                  {category.subtopics.slice(0, 4).map((topic) => (
                    <span key={topic} className="rounded-md bg-surface-soft px-2 py-1">
                      {topic}
                    </span>
                  ))}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- الأحدث ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHead title="أحدث المقالات" href="/articles" linkLabel="الأرشيف الكامل" />
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {latest.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      </section>

      {/* ---------- الثقة ---------- */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-2xl font-bold text-ink">كيف نكتب هنا</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <Principle title="المصدر الأوّلي أولًا">
              كل رقم أو ادعاء غير بديهي يُسنَد إلى ورقة بحثية أو توثيق رسمي أو قياس منشور — لا إلى
              مدونة تنقل عن مدونة.
            </Principle>
            <Principle title="القياس قبل الرأي">
              لا نقول «أفضل» بلا رقم. كل مقارنة تذكر البيانات والإصدار وطريقة القياس حتى تعيد
              إنتاجها بنفسك.
            </Principle>
            <Principle title="حدود الحل معلنة">
              في كل مقال قسم «متى لا يصلح هذا الحل». الهندسة اختيار مقايضات، لا بحث عن حلٍّ سحري.
            </Principle>
          </div>
          <p className="mt-8 text-sm text-ink-muted">
            التفاصيل الكاملة في{" "}
            <Link href="/editorial-policy" className="text-signal hover:underline">
              سياسة التحرير
            </Link>
            ، وطريقة تعاملنا مع الإعلانات في{" "}
            <Link href="/advertising-policy" className="text-signal hover:underline">
              سياسة الإعلانات
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <NewsletterCta />
      </section>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="block font-display text-3xl font-bold text-ink numerals-latn">{value}</span>
        <span className="mt-1 block text-sm text-ink-muted">{label}</span>
      </dd>
    </div>
  );
}

function SectionHead({ title, href, linkLabel }: { title: string; href: string; linkLabel: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
      <h2 className="font-display text-2xl font-bold text-ink">{title}</h2>
      <Link href={href} className="text-sm font-medium text-signal hover:underline">
        {linkLabel} ←
      </Link>
    </div>
  );
}

function Principle({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-bg p-6">
      <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-ink-muted">{children}</p>
    </div>
  );
}

export const metadata = {
  alternates: { canonical: "/" },
  title: `${siteConfig.name} — هندسة أنظمة الذكاء الاصطناعي التطبيقية بالعربية`,
};
