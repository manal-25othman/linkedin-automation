import Link from "next/link";

import { ArticleCard } from "@/components/article-card";
import { NewsletterCta } from "@/components/newsletter-cta";
import { categories } from "@/config/categories";
import { siteConfig } from "@/config/site";
import { getAllArticles, getFeaturedArticles } from "@/lib/articles";

export default function HomePage() {
  const all = getAllArticles();
  const featured = getFeaturedArticles(2);
  const featuredSlugs = new Set(featured.map((article) => article.slug));
  const latest = all.filter((article) => !featuredSlugs.has(article.slug)).slice(0, 6);

  return (
    <>
      {/* ---------- الواجهة ---------- */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <p className="inline-flex items-center gap-2 rounded-full border border-signal-line bg-signal-soft px-3 py-1 text-xs font-medium text-signal">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden="true" />
            مدونة عربية متخصصة — بلا أخبار وبلا مبالغات
          </p>

          <h1 className="mt-6 max-w-3xl font-display text-4xl font-bold leading-[1.35] text-ink md:text-[3.15rem]">
            من المقدّمة إلى النتيجة:
            <span className="text-signal"> هندسة أنظمة الذكاء الاصطناعي</span> بالقياس لا بالانطباع.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-9 text-ink-muted">
            كل ما تحتاجه لنقل نظام مبنيّ على نموذج لغوي من دفتر التجارب إلى الإنتاج: الاسترجاع
            المعزّز، الوكلاء، التقييم، اقتصاد الاستدلال، والأمن — بمراجع أوّلية وكود يعمل.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/articles"
              className="rounded-xl bg-signal px-6 py-3 text-sm font-semibold text-white transition hover:bg-signal-hover"
            >
              ابدأ من المقالات
            </Link>
            <Link
              href="/categories"
              className="rounded-xl border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink transition hover:border-signal-line hover:text-signal"
            >
              تصفّح التصنيفات
            </Link>
          </div>

          <dl className="mt-14 grid gap-6 border-t border-line pt-8 sm:grid-cols-3">
            <Stat value={`${all.length}`} label="مقالًا تقنيًّا منشورًا" />
            <Stat value="6" label="تصنيفات هندسية متخصصة" />
            <Stat value="100%" label="ادعاءات مسنودة إلى مصدر أوّلي" />
          </dl>
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
                className="group rounded-2xl border border-line bg-bg p-6 transition hover:border-signal-line"
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
