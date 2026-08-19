import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ServiceCard } from "@/components/service-card";
import { getCategories, getFeaturedServices, getPublicStats } from "@/lib/queries/catalog";
import { getSettings } from "@/lib/settings";
import { formatBps, formatNumber } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { siteConfig } from "@/config/site";

export const revalidate = 300;

const steps = [
  {
    title: "اختر الخدمة والباقة",
    body: "كل خدمة بثلاث باقات واضحة: ما يشملها السعر، وعدد المراجعات، ومدّة التسليم — بلا مفاوضات ولا مفاجآت.",
  },
  {
    title: "ادفع إلكترونيًا",
    body: "مدى أو بطاقة أو Apple Pay. مبلغك محفوظ حتى تستلم العمل ويُعتمد الطلب.",
  },
  {
    title: "استلم في الموعد",
    body: "متابعة الطلب برقمه في أي وقت، ومراجعات ضمن ما نصّت عليه الباقة، وملفّاتك بكل الصيغ.",
  },
];

export default async function HomePage() {
  const [categories, featured, stats, settings] = await Promise.all([
    getCategories(),
    getFeaturedServices(6),
    getPublicStats(),
    getSettings(),
  ]);

  const topRate = settings.commission.defaultBps + settings.commission.tierBonusBps.GOLD;

  return (
    <>
      {/* البطل */}
      <section className="hero-glow border-b border-line">
        <div className="container-page grid gap-10 py-16 md:grid-cols-2 md:py-24">
          <div>
            <Badge tone="accent">برنامج عمولة يصل إلى {formatBps(topRate)} لكل طلب</Badge>
            <h1 className="mt-5 font-display text-3xl font-extrabold leading-tight md:text-5xl">
              نصمّم متجرك وموقعك
              <span className="text-brand"> وهويتك البصرية</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
              {siteConfig.description}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/services" size="lg">
                تصفّح الخدمات
              </ButtonLink>
              <ButtonLink href="/affiliate" variant="secondary" size="lg">
                اربح من التسويق بالعمولة
              </ButtonLink>
            </div>

            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4">
              {[
                { label: "خدمة متاحة", value: stats.services },
                { label: "طلب مكتمل", value: stats.completed },
                { label: "شريك تسويق", value: stats.affiliates },
              ].map((item) => (
                <div key={item.label} className="card px-4 py-3">
                  <dt className="text-xs text-ink-muted">{item.label}</dt>
                  <dd className="font-display text-2xl font-extrabold text-brand tabular">
                    {formatNumber(item.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="card flex flex-col justify-center gap-5 bg-surface-tint p-8">
            <p className="font-display text-xl font-bold">كيف تعمل المنصّة؟</p>
            <ol className="space-y-5">
              {steps.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white shadow-[0_6px_16px_-8px_rgb(14_124_123/0.9)]">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-semibold">{step.title}</p>
                    <p className="text-sm leading-relaxed text-ink-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* التصنيفات */}
      <section className="container-page py-16">
        <h2 className="font-display text-2xl font-extrabold">أقسام الخدمات</h2>
        <p className="mt-2 text-ink-muted">اختر القسم الذي يناسب احتياجك.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/services?category=${category.slug}`}
              className="card group flex items-start gap-4 p-5 transition-all hover:-translate-y-0.5 hover:border-brand-line hover:shadow-[0_16px_40px_-20px_rgb(14_124_123/0.32)]"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-lg text-brand transition-colors group-hover:bg-accent-soft group-hover:text-accent">
                ✦
              </span>
              <div>
                <p className="font-semibold">{category.name}</p>
                <p className="mt-1 text-sm text-ink-muted">{category.description}</p>
                <p className="mt-2 text-xs text-ink-faint">
                  {formatNumber(category._count.services)} خدمة
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* الأكثر طلبًا */}
      {featured.length > 0 ? (
        <section className="border-y border-line bg-surface-tint py-16">
          <div className="container-page">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-extrabold">الأكثر طلبًا</h2>
                <p className="mt-2 text-ink-muted">خدمات يطلبها عملاؤنا أسبوعيًا.</p>
              </div>
              <Link href="/services" className="text-sm font-semibold text-brand hover:underline">
                كل الخدمات ←
              </Link>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {featured.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* دعوة برنامج العمولة */}
      <section className="container-page py-16">
        <div className="card overflow-hidden border-transparent bg-[linear-gradient(135deg,var(--color-surface-dark),#0e7c7b)] p-8 text-white shadow-[0_24px_60px_-30px_rgb(14_124_123/0.7)] md:p-12">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <Badge tone="accent">دخل إضافي</Badge>
              <h2 className="mt-4 font-display text-2xl font-extrabold text-white md:text-3xl">
                سوّق لخدمات أنجز، واكسب على كل طلب يتم عبر رابطك
              </h2>
              <p className="mt-4 leading-relaxed text-white/75">
                رابط خاص بك وكود خصم لمتابعيك. العمولة تُحتسب تلقائيًا على كل طلب مدفوع،
                وتُعتمد بعد {settings.commission.holdDays} يومًا من اكتمال الخدمة، ثم تسحبها
                على حسابك البنكي عند بلوغ {formatMoney(settings.commission.minPayout)}.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <ButtonLink href="/partner/register" variant="accent" size="lg">
                  سجّل كمسوّق مجانًا
                </ButtonLink>
                <ButtonLink
                  href="/affiliate"
                  variant="secondary"
                  size="lg"
                  className="border-white/25 bg-transparent text-white hover:bg-white/10"
                >
                  تفاصيل البرنامج
                </ButtonLink>
              </div>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                { label: "العمولة الأساسية", value: formatBps(settings.commission.defaultBps) },
                { label: "أعلى مستوى", value: formatBps(topRate) },
                {
                  label: "نافذة الإحالة",
                  value: `${settings.commission.attributionWindowDays} يومًا`,
                },
                { label: "أقل مبلغ سحب", value: formatMoney(settings.commission.minPayout) },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-white/15 bg-white/5 p-4">
                  <dt className="text-xs text-white/60">{item.label}</dt>
                  <dd className="mt-1 font-display text-xl font-extrabold text-accent tabular">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>
    </>
  );
}
