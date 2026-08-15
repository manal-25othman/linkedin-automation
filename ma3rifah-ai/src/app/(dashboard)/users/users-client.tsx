'use client';

import { useState } from 'react';
import { MailCheck, Pencil, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/misc';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/shared/states';
import { ActionButton, CrudDialog } from '@/components/dashboard/crud-dialog';
import { ROLE_LABELS, ASSIGNABLE_ROLES } from '@/lib/auth/rbac';
import { formatRelativeTime, initials } from '@/lib/utils';
import { inviteUserAction, resendAccessLinkAction, updateUserAction } from './actions';
import type { ProfileStatus, UserRole } from '@/types/database';

export interface UserRowData {
  id: string;
  fullName: string;
  email: string;
  jobTitle: string | null;
  role: UserRole;
  status: ProfileStatus;
  departmentId: string | null;
  departmentName: string | null;
  createdAt: string;
}

const STATUS_META: Record<
  ProfileStatus,
  { label: string; variant: 'success' | 'secondary' | 'muted' }
> = {
  ACTIVE: { label: 'نشط', variant: 'success' },
  INVITED: { label: 'بانتظار القبول', variant: 'secondary' },
  DISABLED: { label: 'معطّل', variant: 'muted' },
};

export function UsersClient({
  users,
  departments,
  canManage,
  currentUserId,
}: {
  users: UserRowData[];
  departments: { id: string; name: string }[];
  canManage: boolean;
  currentUserId: string;
}) {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  // يُعرض مرة واحدة ولا يُخزَّن: إغلاق النافذة يمحوه
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [editing, setEditing] = useState<UserRowData | null>(null);

  return (
    <>
      {canManage ? (
        <div className="flex justify-start">
          <Button onClick={() => setIsInviteOpen(true)}>
            <UserPlus className="size-4" aria-hidden />
            إضافة مستخدم
          </Button>
        </div>
      ) : null}

      {users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="لا يوجد مستخدمون"
          description="أضف أعضاء فريقك ليتمكنوا من استخدام المساعد الذكي."
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المستخدم</TableHead>
                <TableHead>الدور</TableHead>
                <TableHead>القسم</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>أُضيف</TableHead>
                {canManage ? <TableHead className="w-24" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback>{initials(user.fullName || user.email)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {user.fullName || '—'}
                          {user.id === currentUserId ? (
                            <span className="ms-2 text-xs text-muted-foreground">(أنت)</span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-muted-foreground" dir="ltr">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant={user.role === 'COMPANY_ADMIN' ? 'default' : 'secondary'}>
                      {ROLE_LABELS[user.role]}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {user.departmentName || '—'}
                  </TableCell>

                  <TableCell>
                    <Badge variant={STATUS_META[user.status].variant}>
                      {STATUS_META[user.status].label}
                    </Badge>
                  </TableCell>

                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatRelativeTime(user.createdAt)}
                  </TableCell>

                  {canManage ? (
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        {user.status !== 'DISABLED' ? (
                          <ActionButton
                            action={() => resendAccessLinkAction(user.id)}
                            size="icon-sm"
                            confirmMessage={
                              `سيصل ${user.email} رابط يضع به كلمة مرور جديدة. ` +
                              'هل تريد إرساله؟'
                            }
                          >
                            <MailCheck
                              className="size-4"
                              aria-label={`إعادة إرسال رابط الدخول إلى ${user.email}`}
                            />
                          </ActionButton>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setEditing(user)}
                          aria-label={`تعديل ${user.fullName || user.email}`}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Button>
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
        open={isInviteOpen}
        onOpenChange={(open) => {
          setIsInviteOpen(open);
          if (!open) setTemporaryPassword(null);
        }}
        title="إضافة مستخدم"
        description="يصل الموظف رابطٌ على بريده يضع به كلمة مروره بنفسه — لن تحتاج إلى تسليمه أي كلمة مرور."
        submitLabel="إضافة"
        action={inviteUserAction}
        onRetain={(result) => {
          if (!result.temporaryPassword) return false;
          setTemporaryPassword(result.temporaryPassword);
          return true;
        }}
      >
        {temporaryPassword ? (
          <div className="rounded-lg border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 p-4">
            <p className="text-sm font-semibold">تعذّر إرسال البريد — كلمة مرور مؤقتة</p>
            <div className="mt-2 flex items-center gap-2">
              <code
                dir="ltr"
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm font-semibold"
              >
                {temporaryPassword}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard.writeText(temporaryPassword)}
              >
                نسخ
              </Button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              أُنشئ الحساب لكن لم تصل الرسالة إلى الموظف. انسخ الكلمة الآن وسلّمها له —
              لن تظهر مرة أخرى — واطلب منه تغييرها بعد أول دخول. ولتفادي ذلك مستقبلًا
              اضبط مزوّد البريد، ثم استخدم زرّ إعادة إرسال الرابط من جدول المستخدمين.
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="fullName">الاسم الكامل *</Label>
          <Input id="fullName" name="fullName" required maxLength={120} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">البريد الإلكتروني *</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            dir="ltr"
            className="text-start"
            maxLength={255}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">الدور *</Label>
          <select
            id="role"
            name="role"
            defaultValue="EMPLOYEE"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {ASSIGNABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="departmentId">القسم</Label>
          <select
            id="departmentId"
            name="departmentId"
            defaultValue=""
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">بدون قسم</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="jobTitle">المسمّى الوظيفي</Label>
          <Input id="jobTitle" name="jobTitle" maxLength={120} />
        </div>
      </CrudDialog>

      <CrudDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="تعديل المستخدم"
        description={editing?.email}
        submitLabel="حفظ التعديلات"
        action={updateUserAction}
      >
        <input type="hidden" name="userId" value={editing?.id ?? ''} />

        <div className="space-y-2">
          <Label htmlFor="edit-fullName">الاسم الكامل *</Label>
          <Input
            id="edit-fullName"
            name="fullName"
            required
            maxLength={120}
            defaultValue={editing?.fullName}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-role">الدور *</Label>
          <select
            id="edit-role"
            name="role"
            defaultValue={editing?.role ?? 'EMPLOYEE'}
            disabled={editing?.id === currentUserId}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {ASSIGNABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          {editing?.id === currentUserId ? (
            <p className="text-xs text-muted-foreground">لا يمكنك تغيير دورك بنفسك.</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-departmentId">القسم</Label>
          <select
            id="edit-departmentId"
            name="departmentId"
            defaultValue={editing?.departmentId ?? ''}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">بدون قسم</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-jobTitle">المسمّى الوظيفي</Label>
          <Input
            id="edit-jobTitle"
            name="jobTitle"
            maxLength={120}
            defaultValue={editing?.jobTitle ?? ''}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-status">الحالة *</Label>
          <select
            id="edit-status"
            name="status"
            defaultValue={editing?.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE'}
            disabled={editing?.id === currentUserId}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <option value="ACTIVE">نشط</option>
            <option value="DISABLED">معطّل — لا يستطيع تسجيل الدخول</option>
          </select>
        </div>
      </CrudDialog>
    </>
  );
}
