import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { saveCategory } from "@/app/actions/admin";
import { ActionForm } from "@/components/admin/action-form";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "التصنيفات", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  await requireStaff();

  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      sortOrder: true,
      isActive: true,
      _count: { select: { services: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold">التصنيفات</h1>
        <p className="mt-1 text-ink-muted">أقسام الخدمات كما تظهر للعميل.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="card p-6">
          <p className="mb-4 font-display text-lg font-bold">إضافة تصنيف</p>
          <ActionForm action={saveCategory} submitLabel="إضافة">
            <div>
              <label className="label-field" htmlFor="name">الاسم</label>
              <input id="name" name="name" className="input-field" required />
            </div>
            <div>
              <label className="label-field" htmlFor="slug">الرابط (لاتيني)</label>
              <input id="slug" name="slug" className="input-field font-mono" dir="ltr" required />
            </div>
            <div>
              <label className="label-field" htmlFor="description">وصف مختصر</label>
              <input id="description" name="description" className="input-field" />
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
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isActive" defaultChecked className="accent-brand" />
              مفعّل
            </label>
          </ActionForm>
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm">
            <thead className="border-b border-line bg-surface-soft text-right">
              <tr className="text-xs text-ink-muted">
                <th className="px-4 py-3 font-medium">التصنيف</th>
                <th className="px-4 py-3 font-medium">الرابط</th>
                <th className="px-4 py-3 font-medium">الخدمات</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    {category.name}
                    <span className="block text-xs text-ink-faint">{category.description}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" dir="ltr">{category.slug}</td>
                  <td className="px-4 py-3 tabular">{formatNumber(category._count.services)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={category.isActive ? "success" : "neutral"}>
                      {category.isActive ? "مفعّل" : "متوقّف"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
