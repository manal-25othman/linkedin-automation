'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FolderTree, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/states';
import { CrudDialog, ActionButton } from '@/components/dashboard/crud-dialog';
import { formatNumber } from '@/lib/utils';
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from './actions';

export interface CategoryCardData {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  documentCount: number;
  readyCount: number;
}

export function KnowledgeBaseClient({
  categories,
  uncategorizedCount,
  canManage,
}: {
  categories: CategoryCardData[];
  uncategorizedCount: number;
  canManage: boolean;
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryCardData | null>(null);

  return (
    <>
      {canManage ? (
        <div className="flex justify-start">
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="size-4" aria-hidden />
            تصنيف جديد
          </Button>
        </div>
      ) : null}

      {categories.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="لا توجد تصنيفات"
          description="التصنيفات تنظّم مستنداتك حسب الجهة — موارد بشرية، مالية، تشغيل — وتُسهّل على الموظفين فهم مصدر الإجابة."
          action={
            canManage ? (
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="size-4" aria-hidden />
                تصنيف جديد
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Card key={category.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: category.color || 'hsl(var(--primary))' }}
                    />
                    <h3 className="truncate text-base font-semibold">{category.name}</h3>
                  </div>

                  {canManage ? (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditing(category)}
                        aria-label={`تعديل ${category.name}`}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <ActionButton
                        size="icon-sm"
                        action={() => deleteCategoryAction(category.id)}
                        confirmMessage={`سيُحذف تصنيف «${category.name}». المستندات المرتبطة به لن تُحذف لكنها ستصبح بلا تصنيف.\n\nهل تريد المتابعة؟`}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-4" aria-hidden />
                        <span className="sr-only">حذف {category.name}</span>
                      </ActionButton>
                    </div>
                  ) : null}
                </div>

                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {category.description || 'بلا وصف'}
                </p>

                <div className="mt-4 flex items-center gap-2">
                  <Badge variant="secondary">
                    {formatNumber(category.documentCount)} مستند
                  </Badge>
                  {category.readyCount < category.documentCount ? (
                    <Badge variant="warning">
                      {formatNumber(category.documentCount - category.readyCount)} قيد المعالجة
                    </Badge>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}

          {uncategorizedCount > 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex h-full flex-col p-5">
                <h3 className="text-base font-semibold text-muted-foreground">بلا تصنيف</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  مستندات لم تُسند إلى أي تصنيف بعد. تصنيفها يُسهّل إدارتها.
                </p>
                <div className="mt-4">
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/documents">
                      {formatNumber(uncategorizedCount)} مستند — عرضها
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}

      <CrudDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title="تصنيف جديد"
        description="التصنيفات تنظّم قاعدة المعرفة وتساعد في تحديد نطاق البحث."
        submitLabel="إنشاء التصنيف"
        action={createCategoryAction}
      >
        <CategoryFields />
      </CrudDialog>

      <CrudDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="تعديل التصنيف"
        submitLabel="حفظ التعديلات"
        action={(formData) => updateCategoryAction(editing!.id, formData)}
      >
        <CategoryFields category={editing ?? undefined} />
      </CrudDialog>
    </>
  );
}

function CategoryFields({ category }: { category?: CategoryCardData }) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="name">اسم التصنيف *</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={100}
          defaultValue={category?.name}
          placeholder="مثال: سياسات الموارد البشرية"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">الوصف</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={category?.description ?? ''}
          placeholder="ما نوع المستندات التي تندرج تحت هذا التصنيف؟"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="color">لون التمييز</Label>
        <input
          id="color"
          name="color"
          type="color"
          defaultValue={category?.color ?? '#0f766e'}
          className="h-10 w-20 cursor-pointer rounded-md border border-input bg-background p-1"
        />
      </div>
    </>
  );
}
