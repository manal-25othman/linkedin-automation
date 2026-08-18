import Link from "next/link";
import type { Metadata } from "next";
import { ServiceCard } from "@/components/service-card";
import { getCategories, listServices } from "@/lib/queries/catalog";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "كل الخدمات",
  description: "تصفّح خدمات أنجز حسب القسم، واطلب الباقة التي تناسبك.",
};

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const params = await searchParams;
  const category = params.category?.trim() || undefined;
  const q = params.q?.trim() || undefined;

  const [categories, services] = await Promise.all([
    getCategories(),
    listServices({ category, q }),
  ]);

  return (
    <div className="container-page py-12">
      <h1 className="font-display text-3xl font-extrabold">الخدمات</h1>
      <p className="mt-2 text-ink-muted">
        {services.length > 0
          ? `${services.length} خدمة متاحة للطلب الآن.`
          : "لا توجد خدمات مطابقة."}
      </p>

      <form className="mt-6 flex gap-2" action="/services">
        {category ? <input type="hidden" name="category" value={category} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="ابحث عن خدمة…"
          className="input-field"
          aria-label="بحث في الخدمات"
        />
        <button type="submit" className="rounded-xl bg-brand px-5 text-sm font-semibold text-white">
          بحث
        </button>
      </form>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/services"
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
            !category
              ? "border-brand bg-brand text-white"
              : "border-line bg-surface text-ink-soft hover:border-brand-line",
          )}
        >
          الكل
        </Link>
        {categories.map((item) => (
          <Link
            key={item.id}
            href={`/services?category=${item.slug}`}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              category === item.slug
                ? "border-brand bg-brand text-white"
                : "border-line bg-surface text-ink-soft hover:border-brand-line",
            )}
          >
            {item.name}
          </Link>
        ))}
      </div>

      {services.length === 0 ? (
        <div className="card mt-10 p-10 text-center">
          <p className="font-semibold">لم نجد خدمة بهذه المواصفات.</p>
          <p className="mt-2 text-sm text-ink-muted">
            جرّب كلمة بحث أخرى، أو{" "}
            <Link href="/services" className="text-brand hover:underline">
              اعرض كل الخدمات
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      )}
    </div>
  );
}
