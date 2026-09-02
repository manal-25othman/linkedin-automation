'use client';

import { useState } from 'react';
import { Eye, EyeOff, Pencil, Plus } from 'lucide-react';
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
import { formatCurrency, formatNumber } from '@/lib/utils';
import { upsertPlanAction, setPlanVisibilityAction } from '../actions';

export interface PlanRowData {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceAmount: number | null;
  currency: string;
  maxUsers: number | null;
  maxDocuments: number | null;
  maxQuestionsMonthly: number | null;
  maxStorageMb: number | null;
  maxOcrPagesMonthly: number | null;
  features: string[];
  isPublic: boolean;
  isCustomPriced: boolean;
  sortOrder: number;
  subscriberCount: number;
}

/** الحقل الفارغ يعني «بلا حد» — لا صفرًا */
function limitValue(value: number | null): string {
  return value === null ? '' : String(value);
}

function limitLabel(value: number | null): string {
  return value === null ? 'بلا حد' : formatNumber(value);
}

export function PlansClient({ plans }: { plans: PlanRowData[] }) {
  const [editing, setEditing] = useState<PlanRowData | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const dialogPlan = editing;

  return (
    <>
      <div className="flex justify-start">
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="size-4" aria-hidden />
          إضافة خطة
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الخطة</TableHead>
              <TableHead>السعر</TableHead>
              <TableHead>المستخدمون</TableHead>
              <TableHead>المستندات</TableHead>
              <TableHead>الأسئلة/شهر</TableHead>
              <TableHead>المشتركون</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell>
                  <p className="font-medium">{plan.name}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">
                    {plan.code}
                  </p>
                </TableCell>
                <TableCell className="tabular-nums text-sm">
                  {plan.isCustomPriced
                    ? 'حسب الطلب'
                    : formatCurrency(plan.priceAmount, plan.currency)}
                </TableCell>
                <TableCell className="tabular-nums text-sm">
                  {limitLabel(plan.maxUsers)}
                </TableCell>
                <TableCell className="tabular-nums text-sm">
                  {limitLabel(plan.maxDocuments)}
                </TableCell>
                <TableCell className="tabular-nums text-sm">
                  {limitLabel(plan.maxQuestionsMonthly)}
                </TableCell>
                <TableCell className="tabular-nums text-sm">
                  {formatNumber(plan.subscriberCount)}
                </TableCell>
                <TableCell>
                  <Badge variant={plan.isPublic ? 'success' : 'muted'}>
                    {plan.isPublic ? 'معروضة' : 'مخفية'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-0.5">
                    <ActionButton
                      size="icon-sm"
                      action={setPlanVisibilityAction.bind(null, plan.id, !plan.isPublic)}
                      confirmMessage={
                        plan.isPublic
                          ? `ستختفي «${plan.name}» من صفحة الأسعار. المشتركون بها لا يتأثرون.\n\nهل تريد المتابعة؟`
                          : undefined
                      }
                    >
                      {plan.isPublic ? (
                        <EyeOff className="size-4" aria-label={`إخفاء ${plan.name}`} />
                      ) : (
                        <Eye className="size-4" aria-label={`إظهار ${plan.name}`} />
                      )}
                    </ActionButton>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditing(plan)}
                      aria-label={`تعديل ${plan.name}`}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <CrudDialog
        open={isCreating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreating(false);
            setEditing(null);
          }
        }}
        title={dialogPlan ? `تعديل «${dialogPlan.name}»` : 'إضافة خطة'}
        description="ما تحفظه هنا يظهر مباشرةً على صفحة الأسعار، وتُقاس عليه حدود كل شركة مشتركة."
        submitLabel={dialogPlan ? 'حفظ' : 'إضافة'}
        action={upsertPlanAction}
      >
        {/* مفتاح يُجبر React على إعادة بناء الحقول عند تبديل الخطة —
            وإلا احتفظت defaultValue بقيم الخطة السابقة. */}
        <div key={dialogPlan?.id ?? 'new'} className="space-y-5">
          <input type="hidden" name="planId" value={dialogPlan?.id ?? ''} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">اسم الخطة *</Label>
              <Input id="name" name="name" required maxLength={60} defaultValue={dialogPlan?.name} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">الرمز *</Label>
              <Input
                id="code"
                name="code"
                required
                dir="ltr"
                className="text-start font-mono"
                maxLength={30}
                placeholder="STARTER"
                defaultValue={dialogPlan?.code}
              />
              <p className="text-xs text-muted-foreground">
                حروف إنجليزية كبيرة وشرطة سفلية. لا يُغيَّر بعد اشتراك شركات به.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">الوصف</Label>
            <Input
              id="description"
              name="description"
              maxLength={300}
              defaultValue={dialogPlan?.description ?? ''}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="priceAmount">السعر الشهري</Label>
              <Input
                id="priceAmount"
                name="priceAmount"
                type="number"
                min={0}
                step="0.01"
                dir="ltr"
                className="text-start"
                defaultValue={dialogPlan?.priceAmount ?? ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">العملة</Label>
              <Input
                id="currency"
                name="currency"
                dir="ltr"
                className="text-start"
                maxLength={3}
                defaultValue={dialogPlan?.currency ?? 'SAR'}
              />
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-lg border p-3">
            <input
              type="checkbox"
              name="isCustomPriced"
              defaultChecked={dialogPlan?.isCustomPriced ?? false}
              className="mt-0.5 size-4 accent-[hsl(var(--primary))]"
            />
            <span className="text-sm">
              حسب الطلب
              <span className="mt-0.5 block text-xs text-muted-foreground">
                تُعرض «حسب الطلب» بدل السعر، ويُتجاهل الرقم المكتوب أعلاه.
              </span>
            </span>
          </label>

          <fieldset className="space-y-4 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">الحدود</legend>
            <p className="text-xs leading-relaxed text-muted-foreground">
              اترك الحقل فارغًا ليكون «بلا حد». الصفر غير مقبول لأنه يوقف الاستخدام كليًا.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maxUsers">المستخدمون</Label>
                <Input
                  id="maxUsers"
                  name="maxUsers"
                  type="number"
                  min={1}
                  dir="ltr"
                  className="text-start"
                  defaultValue={limitValue(dialogPlan?.maxUsers ?? null)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxDocuments">المستندات</Label>
                <Input
                  id="maxDocuments"
                  name="maxDocuments"
                  type="number"
                  min={1}
                  dir="ltr"
                  className="text-start"
                  defaultValue={limitValue(dialogPlan?.maxDocuments ?? null)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxQuestionsMonthly">الأسئلة شهريًا</Label>
                <Input
                  id="maxQuestionsMonthly"
                  name="maxQuestionsMonthly"
                  type="number"
                  min={1}
                  dir="ltr"
                  className="text-start"
                  defaultValue={limitValue(dialogPlan?.maxQuestionsMonthly ?? null)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxStorageMb">التخزين (ميغابايت)</Label>
                <Input
                  id="maxStorageMb"
                  name="maxStorageMb"
                  type="number"
                  min={1}
                  dir="ltr"
                  className="text-start"
                  defaultValue={limitValue(dialogPlan?.maxStorageMb ?? null)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxOcrPagesMonthly">صفحات القراءة الضوئية شهريًا</Label>
                <Input
                  id="maxOcrPagesMonthly"
                  name="maxOcrPagesMonthly"
                  type="number"
                  min={1}
                  dir="ltr"
                  className="text-start"
                  defaultValue={limitValue(dialogPlan?.maxOcrPagesMonthly ?? null)}
                />
                <p className="text-xs text-muted-foreground">
                  للمستندات الممسوحة ضوئيًا والصور. فارغ = بلا حد.
                </p>
              </div>
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="features">المزايا — ميزة في كل سطر</Label>
            <textarea
              id="features"
              name="features"
              rows={6}
              maxLength={2000}
              defaultValue={(dialogPlan?.features ?? []).join('\n')}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              تظهر بجانب علامة صح في بطاقة الخطة على صفحة الأسعار.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sortOrder">ترتيب العرض</Label>
              <Input
                id="sortOrder"
                name="sortOrder"
                type="number"
                min={0}
                max={999}
                dir="ltr"
                className="text-start"
                defaultValue={dialogPlan?.sortOrder ?? plans.length + 1}
              />
            </div>

            <label className="flex items-center gap-3 self-end rounded-lg border p-3">
              <input
                type="checkbox"
                name="isPublic"
                defaultChecked={dialogPlan?.isPublic ?? true}
                className="size-4 accent-[hsl(var(--primary))]"
              />
              <span className="text-sm">معروضة على صفحة الأسعار</span>
            </label>
          </div>
        </div>
      </CrudDialog>
    </>
  );
}
