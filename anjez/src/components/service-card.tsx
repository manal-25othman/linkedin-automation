import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import type { ServiceCard as ServiceCardType } from "@/lib/queries/catalog";

export function ServiceCard({ service }: { service: ServiceCardType }) {
  const startingPrice = service.tiers[0]?.price;
  const deliveryDays = service.tiers[0]?.deliveryDays;

  return (
    <Link
      href={`/services/${service.slug}`}
      className="card group flex flex-col p-5 transition-all hover:border-brand-line hover:shadow-md"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <Badge tone="brand">{service.category.name}</Badge>
        {service.isFeatured ? <Badge tone="accent">الأكثر طلبًا</Badge> : null}
      </div>

      <h3 className="font-display text-lg font-bold transition-colors group-hover:text-brand">
        {service.title}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-muted">{service.summary}</p>

      <div className="mt-4 flex items-end justify-between border-t border-line pt-4">
        <div>
          <p className="text-xs text-ink-faint">تبدأ من</p>
          <p className="font-display text-lg font-extrabold text-ink tabular">
            {startingPrice != null ? formatMoney(startingPrice) : "حسب الطلب"}
          </p>
        </div>
        {deliveryDays ? (
          <p className="text-xs font-medium text-ink-muted">
            التسليم خلال {deliveryDays} أيام
          </p>
        ) : null}
      </div>
    </Link>
  );
}
