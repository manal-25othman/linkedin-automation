'use client';

import { useState } from 'react';
import { Eye, EyeOff, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ActionButton, CrudDialog } from '@/components/dashboard/crud-dialog';
import type { SitePage } from '@/lib/content/pages';
import {
  createSitePageAction,
  updateSitePageAction,
  setSitePageStatusAction,
  deleteSitePageAction,
} from '../actions';

/**
 * إدارة الصفحات التي يصنعها مالك المنصة.
 *
 * والقرار الأهم هنا أن الصفحة تُولد **مسوّدة**: من يكتب صفحة يكتبها على
 * دفعات، ولو نُشرت لحظة الحفظ لَرآها الزوّار نصف مكتوبة. والنشر خطوة
 * منفصلة مقصودة لأنها القرار الوحيد الذي لا يُلغى بسهولة — ما رآه زائر
 * قد يبقى في ذاكرة محرك بحث بعد إخفائه.
 */

const BODY_HELP =
  '## عنوان   ·   - عنصر قائمة   ·   1. عنصر مرقّم   ·   **عريض**   ·   [نصّ](/الرابط)';

function PageForm({ page }: { page?: SitePage }) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="title">عنوان الصفحة</Label>
        <Input id="title" name="title" defaultValue={page?.title} required maxLength={200} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="slug">اسم الرابط</Label>
        <Input
          id="slug"
          name="slug"
          defaultValue={page?.slug}
          required
          minLength={2}
          maxLength={60}
          placeholder="مثال: للشركاء"
          dir="auto"
        />
        <p className="text-xs text-muted-foreground">
          تظهر الصفحة على <span dir="ltr">/p/الاسم</span> — بلا مسافات، والشَّرطة بدلها.
          وتغييره بعد النشر يكسر كل رابط منسوخ للصفحة.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">وصف مختصر</Label>
        <Input
          id="description"
          name="description"
          defaultValue={page?.description ?? ''}
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground">
          يظهر تحت العنوان، وفي نتائج محركات البحث.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="body">المحتوى</Label>
        <textarea
          id="body"
          name="body"
          rows={14}
          defaultValue={page?.body ?? ''}
          maxLength={200_000}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-loose shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs leading-relaxed text-muted-foreground">{BODY_HELP}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sortOrder">ترتيب الظهور</Label>
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            min={0}
            max={999}
            defaultValue={page?.sortOrder ?? 0}
          />
        </div>

        <div className="space-y-3 pt-6">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="showInNav"
              defaultChecked={page?.showInNav ?? false}
              className="size-4 accent-[hsl(var(--primary))]"
            />
            إظهارها في قائمة الموقع
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="status"
              value="PUBLISHED"
              defaultChecked={page?.status === 'PUBLISHED'}
              className="size-4 accent-[hsl(var(--primary))]"
            />
            نشرها للزوّار الآن
          </label>
        </div>
      </div>
    </>
  );
}

export function PagesClient({ pages }: { pages: SitePage[] }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SitePage | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden />
          صفحة جديدة
        </Button>
      </div>

      <Card>
        {pages.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            لا صفحات بعد. أنشئي صفحة واكتبي محتواها، ثم انشريها حين تكتمل.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>العنوان</TableHead>
                <TableHead>الرابط</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>في القائمة</TableHead>
                <TableHead className="text-start">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((page) => (
                <TableRow key={page.id}>
                  <TableCell className="font-medium">{page.title}</TableCell>
                  <TableCell>
                    <span dir="ltr" className="text-xs text-muted-foreground">
                      /p/{page.slug}
                    </span>
                  </TableCell>
                  <TableCell>
                    {page.status === 'PUBLISHED' ? (
                      <Badge variant="success">منشورة</Badge>
                    ) : (
                      <Badge variant="secondary">مسوّدة</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {page.showInNav ? 'نعم' : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(page)}
                      >
                        <Pencil className="size-4" aria-hidden />
                        تحرير
                      </Button>

                      <ActionButton
                        action={setSitePageStatusAction.bind(
                          null,
                          page.id,
                          page.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED',
                        )}
                      >
                        {page.status === 'PUBLISHED' ? (
                          <>
                            <EyeOff className="size-4" aria-hidden />
                            إخفاء
                          </>
                        ) : (
                          <>
                            <Eye className="size-4" aria-hidden />
                            نشر
                          </>
                        )}
                      </ActionButton>

                      {page.status === 'PUBLISHED' ? (
                        <Button variant="ghost" size="sm" asChild>
                          <a
                            href={`/p/${encodeURIComponent(page.slug)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="size-4" aria-hidden />
                            معاينة
                          </a>
                        </Button>
                      ) : null}

                      <ActionButton
                        variant="ghost"
                        action={deleteSitePageAction.bind(null, page.id)}
                        confirmMessage={`حذف «${page.title}» نهائيًا؟ لا يمكن التراجع، وكل رابط لها يصير معطّلًا.`}
                      >
                        <Trash2 className="size-4 text-destructive" aria-hidden />
                      </ActionButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <CrudDialog
        open={creating}
        onOpenChange={setCreating}
        title="صفحة جديدة"
        description="تُحفظ مسوّدة ما لم تعلّمي النشر — والمسوّدة لا يصل إليها أحد."
        submitLabel="حفظ"
        action={createSitePageAction}
      >
        <PageForm />
      </CrudDialog>

      {editing ? (
        <CrudDialog
          key={editing.id}
          open
          onOpenChange={(next) => {
            if (!next) setEditing(null);
          }}
          title={`تحرير: ${editing.title}`}
          submitLabel="حفظ"
          action={updateSitePageAction.bind(null, editing.id)}
        >
          <PageForm page={editing} />
        </CrudDialog>
      ) : null}
    </div>
  );
}
