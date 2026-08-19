import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServiceBySlug } from "@/lib/queries/catalog";
import { getReferralContext } from "@/lib/affiliate/attribution";
import { OrderForm } from "@/components/order/order-form";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "إتمام الطلب",
  robots: { index: false, follow: false },
};

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tier?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const service = await getServiceBySlug(slug);

  if (!service || service.tiers.length === 0) notFound();

  const referral = await getReferralContext();
  const defaultTier =
    service.tiers.find((tier) => tier.id === query.tier) ?? service.tiers[0];

  return (
    <div className="container-page py-12">
      <nav className="text-sm text-ink-muted">
        <Link href={`/services/${service.slug}`} className="hover:text-brand">
          ← رجوع إلى {service.title}
        </Link>
      </nav>

      <h1 className="mt-4 font-display text-3xl font-extrabold">إتمام طلب: {service.title}</h1>
      <p className="mt-2 text-ink-muted">{service.summary}</p>

      {referral ? (
        <p className="mt-4">
          <Badge tone="accent">وصلت عبر إحالة {referral.affiliateName} — كود {referral.code}</Badge>
        </p>
      ) : null}

      <div className="mt-8">
        <OrderForm tiers={service.tiers} defaultTierId={defaultTier.id} />
      </div>
    </div>
  );
}
