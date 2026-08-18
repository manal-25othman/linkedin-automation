import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { saveService } from "@/app/actions/admin";
import { ActionForm } from "@/components/admin/action-form";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { formatBps } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "الخدمات", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminServicesPage() {
  await requireStaff();

  const [services, categories, settings] = await Promise.all([
    prisma.service.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        isActive: true,
        isFeatured: true,
        commissionBps: true,
        category: { select: { name: true } },
        tiers: { where: { isActive: true }, orderBy: { price: "asc" }, take: 1, select: { price: true } },
        _count: { select: { orders: true } },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getSettings(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">الخدمات</h1>
        <p className="mt-1 text-ink-muted">
          النسبة الفارغة تعني اعتماد النسبة العامة ({formatBps(settings.commission.defaultBps)}).
        </p>
      </div>

      <div className="card p-6">
        <p className="mb-4 font-display text-lg font-bold">خدمة جديدة</p>
        <ActionForm action={saveService} submitLabel="إنشاء الخدمة" className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label-field" htmlFor="title">العنوان</label>
            <input id="title" name="title" className="input-field" required />
          </div>
          <div>
            <label className="label-field" htmlFor="slug">الرابط (لاتيني)</label>
            <input id="slug" name="slug" className="input-field font-mono" dir="ltr" required />
          </div>
          <div className="md:col-span-2">
            <label className="label-field" htmlFor="summary">وصف مختصر</label>
            <input id="summary" name="summary" className="input-field" required />
          </div>
          <div>
            <label className="label-field" htmlFor="categoryId">التصنيف</label>
            <select id="categoryId" name="categoryId" className="input-field" required>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field" htmlFor="commissionPercent">نسبة العمولة ٪ (اختياري)</label>
            <input
              id="commissionPercent"
              name="commissionPercent"
              className="input-field"
              placeholder="مثال: 20"
            />
          </div>
          <div className="flex items-center gap-5 md:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isActive" defaultChecked className="accent-brand" />
              مفعّلة
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isFeatured" className="accent-brand" />
              مميّزة في الرئيسية
            </label>
          </div>
        </ActionForm>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="border-b border-line bg-surface-soft text-right">
            <tr className="text-xs text-ink-muted">
              <th className="px-4 py-3 font-medium">الخدمة</th>
              <th className="px-4 py-3 font-medium">التصنيف</th>
              <th className="px-4 py-3 font-medium">تبدأ من</th>
              <th className="px-4 py-3 font-medium">العمولة</th>
              <th className="px-4 py-3 font-medium">الطلبات</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id} className="border-b border-line last:border-0 hover:bg-surface-soft">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/services/${service.id}`}
                    className="font-semibold text-brand hover:underline"
                  >
                    {service.title}
                  </Link>
                  <span className="block font-mono text-xs text-ink-faint" dir="ltr">
                    /{service.slug}
                  </span>
                </td>
                <td className="px-4 py-3">{service.category.name}</td>
                <td className="px-4 py-3 tabular">
                  {service.tiers[0] ? formatMoney(service.tiers[0].price) : "بلا باقات"}
                </td>
                <td className="px-4 py-3 tabular">
                  {service.commissionBps != null ? formatBps(service.commissionBps) : "العامة"}
                </td>
                <td className="px-4 py-3 tabular">{service._count.orders}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Badge tone={service.isActive ? "success" : "neutral"}>
                      {service.isActive ? "مفعّلة" : "متوقّفة"}
                    </Badge>
                    {service.isFeatured ? <Badge tone="gold">مميّزة</Badge> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
