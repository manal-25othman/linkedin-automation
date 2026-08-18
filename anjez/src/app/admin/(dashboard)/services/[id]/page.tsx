import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { deactivateTier, saveService, saveTier } from "@/app/actions/admin";
import { ActionForm } from "@/components/admin/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney, halalasToRiyals } from "@/lib/money";

export const metadata: Metadata = { title: "تحرير الخدمة", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminServiceEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;

  const [service, categories] = await Promise.all([
    prisma.service.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        description: true,
        requirements: true,
        categoryId: true,
        commissionBps: true,
        sortOrder: true,
        isActive: true,
        isFeatured: true,
        tiers: {
          orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
          select: {
            id: true,
            name: true,
            price: true,
            deliveryDays: true,
            features: true,
            sortOrder: true,
            isActive: true,
            _count: { select: { orders: true } },
          },
        },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!service) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/services" className="text-sm text-brand hover:underline">
          ← كل الخدمات
        </Link>
        <Link
          href={`/services/${service.slug}`}
          target="_blank"
          className="text-sm text-ink-muted hover:text-brand"
        >
          عرض الصفحة العامة ↗
        </Link>
      </div>

      <h1 className="font-display text-2xl font-extrabold">{service.title}</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <p className="mb-4 font-display text-lg font-bold">بيانات الخدمة</p>
          <ActionForm action={saveService} submitLabel="حفظ التعديلات">
            <input type="hidden" name="id" value={service.id} />

            <div>
              <label className="label-field" htmlFor="title">العنوان</label>
              <input id="title" name="title" className="input-field" defaultValue={service.title} required />
            </div>
            <div>
              <label className="label-field" htmlFor="slug">الرابط</label>
              <input
                id="slug"
                name="slug"
                className="input-field font-mono"
                dir="ltr"
                defaultValue={service.slug}
                required
              />
            </div>
            <div>
              <label className="label-field" htmlFor="summary">وصف مختصر</label>
              <input id="summary" name="summary" className="input-field" defaultValue={service.summary} required />
            </div>
            <div>
              <label className="label-field" htmlFor="description">الوصف التفصيلي (فقرة لكل سطر)</label>
              <textarea
                id="description"
                name="description"
                rows={5}
                className="input-field"
                defaultValue={service.description}
              />
            </div>
            <div>
              <label className="label-field" htmlFor="requirements">متطلبات من العميل (بند لكل سطر)</label>
              <textarea
                id="requirements"
                name="requirements"
                rows={4}
                className="input-field"
                defaultValue={service.requirements}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label-field" htmlFor="categoryId">التصنيف</label>
                <select
                  id="categoryId"
                  name="categoryId"
                  className="input-field"
                  defaultValue={service.categoryId}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-field" htmlFor="commissionPercent">نسبة العمولة ٪</label>
                <input
                  id="commissionPercent"
                  name="commissionPercent"
                  className="input-field"
                  defaultValue={service.commissionBps != null ? service.commissionBps / 100 : ""}
                  placeholder="اتركه فارغًا للنسبة العامة"
                />
              </div>
            </div>
            <div>
              <label className="label-field" htmlFor="sortOrder">الترتيب</label>
              <input
                id="sortOrder"
                name="sortOrder"
                type="number"
                min={0}
                className="input-field"
                defaultValue={service.sortOrder}
              />
            </div>
            <div className="flex items-center gap-5">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={service.isActive}
                  className="accent-brand"
                />
                مفعّلة
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isFeatured"
                  defaultChecked={service.isFeatured}
                  className="accent-brand"
                />
                مميّزة
              </label>
            </div>
          </ActionForm>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <p className="mb-4 font-display text-lg font-bold">إضافة باقة</p>
            <ActionForm action={saveTier} submitLabel="إضافة الباقة">
              <input type="hidden" name="serviceId" value={service.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label-field" htmlFor="name">اسم الباقة</label>
                  <input id="name" name="name" className="input-field" required />
                </div>
                <div>
                  <label className="label-field" htmlFor="price">السعر (ريال)</label>
                  <input id="price" name="price" className="input-field" required />
                </div>
                <div>
                  <label className="label-field" htmlFor="deliveryDays">مدّة التسليم (أيام)</label>
                  <input
                    id="deliveryDays"
                    name="deliveryDays"
                    type="number"
                    min={1}
                    defaultValue={3}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="label-field" htmlFor="sortOrder">الترتيب</label>
                  <input
                    id="sortOrder"
                    name="sortOrder"
                    type="number"
                    min={0}
                    defaultValue={0}
                    className="input-field"
                  />
                </div>
              </div>
              <div>
                <label className="label-field" htmlFor="features">المزايا (ميزة لكل سطر)</label>
                <textarea id="features" name="features" rows={4} className="input-field" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isActive" defaultChecked className="accent-brand" />
                مفعّلة
              </label>
            </ActionForm>
          </div>

          <div className="card p-6">
            <p className="mb-4 font-display text-lg font-bold">الباقات الحالية</p>

            {service.tiers.length === 0 ? (
              <p className="text-sm text-ink-muted">لا توجد باقات بعد — الخدمة لن تقبل الطلبات.</p>
            ) : (
              <ul className="space-y-3">
                {service.tiers.map((tier) => (
                  <li key={tier.id} className="rounded-xl border border-line p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{tier.name}</p>
                        <p className="text-xs text-ink-muted">
                          {formatMoney(tier.price)} · {tier.deliveryDays} أيام ·{" "}
                          {tier._count.orders} طلب
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={tier.isActive ? "success" : "neutral"}>
                          {tier.isActive ? "مفعّلة" : "متوقّفة"}
                        </Badge>
                        <form action={deactivateTier}>
                          <input type="hidden" name="id" value={tier.id} />
                          <Button type="submit" variant="secondary" size="sm">
                            {tier._count.orders > 0 ? "إيقاف" : "حذف"}
                          </Button>
                        </form>
                      </div>
                    </div>

                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-semibold text-brand">
                        تعديل الباقة
                      </summary>
                      <div className="mt-3">
                        <ActionForm action={saveTier} submitLabel="حفظ الباقة">
                          <input type="hidden" name="id" value={tier.id} />
                          <input type="hidden" name="serviceId" value={service.id} />
                          <div className="grid gap-3 sm:grid-cols-2">
                            <input
                              name="name"
                              className="input-field"
                              defaultValue={tier.name}
                              aria-label="اسم الباقة"
                            />
                            <input
                              name="price"
                              className="input-field"
                              defaultValue={halalasToRiyals(tier.price)}
                              aria-label="السعر بالريال"
                            />
                            <input
                              name="deliveryDays"
                              type="number"
                              min={1}
                              className="input-field"
                              defaultValue={tier.deliveryDays}
                              aria-label="مدّة التسليم"
                            />
                            <input
                              name="sortOrder"
                              type="number"
                              min={0}
                              className="input-field"
                              defaultValue={tier.sortOrder}
                              aria-label="الترتيب"
                            />
                          </div>
                          <textarea
                            name="features"
                            rows={3}
                            className="input-field"
                            defaultValue={tier.features}
                            aria-label="المزايا"
                          />
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              name="isActive"
                              defaultChecked={tier.isActive}
                              className="accent-brand"
                            />
                            مفعّلة
                          </label>
                        </ActionForm>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
