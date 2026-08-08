'use client';

import { useState } from 'react';
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/shared/states';
import { CrudDialog, ActionButton } from '@/components/dashboard/crud-dialog';
import { formatNumber } from '@/lib/utils';
import {
  createDepartmentAction,
  updateDepartmentAction,
  deleteDepartmentAction,
} from './actions';

export interface DepartmentRowData {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  memberCount: number;
}

export function DepartmentsClient({
  departments,
  canManage,
}: {
  departments: DepartmentRowData[];
  canManage: boolean;
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentRowData | null>(null);

  return (
    <>
      {canManage ? (
        <div className="flex justify-start">
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="size-4" aria-hidden />
            قسم جديد
          </Button>
        </div>
      ) : null}

      {departments.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="لا توجد أقسام"
          description="نظّم موظفيك في أقسام لتتمكن من تقييد صلاحيات المستندات ومتابعة تحليلات كل قسم."
          action={
            canManage ? (
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="size-4" aria-hidden />
                قسم جديد
              </Button>
            ) : null
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>القسم</TableHead>
                <TableHead>الرمز</TableHead>
                <TableHead>الوصف</TableHead>
                <TableHead>الموظفون</TableHead>
                {canManage ? <TableHead className="w-28" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((department) => (
                <TableRow key={department.id}>
                  <TableCell className="font-medium">{department.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {department.code || '—'}
                  </TableCell>
                  <TableCell className="max-w-sm text-sm text-muted-foreground">
                    <span className="line-clamp-1">{department.description || '—'}</span>
                  </TableCell>
                  <TableCell className="tabular-nums text-sm">
                    {formatNumber(department.memberCount)}
                  </TableCell>
                  {canManage ? (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setEditing(department)}
                          aria-label={`تعديل ${department.name}`}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                        <ActionButton
                          size="icon-sm"
                          action={() => deleteDepartmentAction(department.id)}
                          confirmMessage={`هل تريد حذف قسم «${department.name}»؟`}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-4" aria-hidden />
                          <span className="sr-only">حذف {department.name}</span>
                        </ActionButton>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <CrudDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title="قسم جديد"
        description="أنشئ قسمًا لتنظيم الموظفين وتقييد صلاحيات المستندات."
        submitLabel="إنشاء القسم"
        action={createDepartmentAction}
      >
        <DepartmentFields />
      </CrudDialog>

      <CrudDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="تعديل القسم"
        submitLabel="حفظ التعديلات"
        action={(formData) => updateDepartmentAction(editing!.id, formData)}
      >
        <DepartmentFields department={editing ?? undefined} />
      </CrudDialog>
    </>
  );
}

function DepartmentFields({ department }: { department?: DepartmentRowData }) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="name">اسم القسم *</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={100}
          defaultValue={department?.name}
          placeholder="مثال: الموارد البشرية"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="code">الرمز</Label>
        <Input
          id="code"
          name="code"
          maxLength={20}
          defaultValue={department?.code ?? ''}
          placeholder="HR"
          dir="ltr"
          className="text-start"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">الوصف</Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          maxLength={500}
          defaultValue={department?.description ?? ''}
        />
      </div>
    </>
  );
}
