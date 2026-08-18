import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServiceBySlug } from "@/lib/queries/catalog";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = await getServiceBySlug(slug);
  if (!service) return { title: "الخدمة غير متاحة" };

  return {
    title: service.title,
    description: service.summary,
    alternates: { canonical: `/services/${service.slug}` },
  };
}

/** الوصف والمزايا نصوص بسيطة سطرًا سطرًا — لا محرّر غنيّ ولا HTML من الأدمن. */
function lines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default async function ServicePage({ params }: Props) {
  const { slug } = await params;
  const service = await getServiceBySlug(slug);
  if (!service) notFound();

  const requirements = lines(service.requirements);
  const description = lines(service.description);

  return (
    <div className="container-page py-12">
      <nav className="text-sm text-ink-muted">
        <Link href="/services" className="hover:text-brand">
          الخدمات
        </Link>
        <span className="mx-2">/</span>
        <Link href={`/services?category=${service.category.slug}`} className="hover:text-brand">
          {service.category.name}
        </Link>
      </nav>

      <div className="mt-4 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <Badge tone="brand">{service.category.name}</Badge>
          <h1 className="mt-4 font-display text-3xl font-extrabold">{service.title}</h1>
          <p className="mt-3 text-lg leading-relaxed text-ink-soft">{service.summary}</p>

          {description.length > 0 ? (
            <div className="mt-8 space-y-3">
              <h2 className="font-display text-xl font-bold">تفاصيل الخدمة</h2>
              {description.map((paragraph) => (
                <p key={paragraph} className="leading-relaxed text-ink-soft">
                  {paragraph}
                </p>
              ))}
            </div>
          ) : null}

          {requirements.length > 0 ? (
            <div className="card mt-8 p-6">
              <h2 className="font-display text-lg font-bold">ما نحتاجه منك بعد الطلب</h2>
              <ul className="mt-4 space-y-2">
                {requirements.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-ink-soft">
                    <span className="text-brand">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <h2 className="font-display text-xl font-bold">اختر باقتك</h2>

          {service.tiers.length === 0 ? (
            <p className="card p-5 text-sm text-ink-muted">
              لا توجد باقات متاحة لهذه الخدمة حاليًا.
            </p>
          ) : (
            service.tiers.map((tier, index) => (
              <div
                key={tier.id}
                className={`card p-5 ${index === 1 ? "border-brand-line ring-1 ring-brand-soft" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-lg font-bold">{tier.name}</p>
                  {index === 1 ? <Badge tone="gold">الأفضل قيمة</Badge> : null}
                </div>

                <p className="mt-2 font-display text-2xl font-extrabold text-brand tabular">
                  {formatMoney(tier.price)}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  التسليم خلال {tier.deliveryDays} أيام عمل
                </p>

                <ul className="mt-4 space-y-2 border-t border-line pt-4">
                  {lines(tier.features).map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm text-ink-soft">
                      <span className="text-success">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <ButtonLink
                  href={`/order/${service.slug}?tier=${tier.id}`}
                  className="mt-5 w-full"
                  variant={index === 1 ? "primary" : "secondary"}
                >
                  اطلب الآن
                </ButtonLink>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
