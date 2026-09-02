'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, FileUp, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { driveProcessing } from './processing-loop';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatBytes } from '@/lib/utils';
import {
  createUploadTicketAction,
  finalizeUploadAction,
} from '@/app/(dashboard)/documents/actions';
import { createClient } from '@/lib/supabase/client';
import { ROLE_LABELS } from '@/lib/auth/rbac';
import type { DocumentVisibility, UserRole } from '@/types/database';

const ACCEPTED = '.pdf,.docx,.xlsx,.xls,.csv,.txt,.md';
const MAX_BYTES = 25 * 1024 * 1024;
const ASSIGNABLE_ROLES: UserRole[] = ['COMPANY_ADMIN', 'MANAGER', 'EMPLOYEE'];

export function UploadDialog({
  categories,
  departments,
}: {
  categories: { id: string; name: string }[];
  departments: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<DocumentVisibility>('COMPANY');
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** المرحلة الجارية — الرفع ثلاث خطوات، وصمتها يُقرأ تعليقًا */
  const [stage, setStage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const reset = () => {
    setFile(null);
    setName('');
    setVisibility('COMPANY');
    setSelectedDepartments([]);
    setSelectedRoles([]);
    setError(null);
    setStage(null);
    formRef.current?.reset();
  };

  const pickFile = (selected: File | null) => {
    setError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError(`حجم الملف يتجاوز ${formatBytes(MAX_BYTES)}.`);
      setFile(null);
      return;
    }
    setFile(selected);
    if (!name) setName(selected.name.replace(/\.[^.]+$/, ''));
  };

  const submit = (formData: FormData) => {
    setError(null);

    if (!file) {
      setError('اختر ملفًا للرفع.');
      return;
    }

    formData.set('visibility', visibility);
    formData.delete('allowedDepartmentIds');
    formData.delete('allowedRoles');
    if (visibility === 'DEPARTMENT') {
      for (const id of selectedDepartments) formData.append('allowedDepartmentIds', id);
    }
    if (visibility === 'ROLE') {
      for (const role of selectedRoles) formData.append('allowedRoles', role);
    }

    startTransition(async () => {
      // ------------------------------------------------------------
      // الرفع على ثلاث خطوات، والملف لا يمرّ بخادمنا في أيٍّ منها:
      //
      //   ١) تذكرة: يتحقق الخادم من الصلاحية والنوع والحدود، ويأذن
      //      بمسار واحد بعينه.
      //   ٢) رفع مباشر من المتصفح إلى التخزين بذلك الإذن — وهنا تُتجاوز
      //      حدود حجم الطلب على منصة الاستضافة، إذ لا يمرّ بها شيء.
      //   ٣) إنهاء: يقرأ الخادم الملف من التخزين، فيتحقق من حجمه
      //      وبصمته بنفسه، ثم يُدخله قاعدة المعرفة.
      // ------------------------------------------------------------
      setStage('جارٍ التجهيز…');

      const ticket = await createUploadTicketAction({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      });

      if (!ticket.ok || !ticket.ticket) {
        setStage(null);
        setError(ticket.message ?? 'تعذّر تجهيز الرفع.');
        return;
      }

      setStage('جارٍ رفع الملف…');

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .uploadToSignedUrl(ticket.ticket.path, ticket.ticket.token, file, {
          contentType: file.type || 'application/octet-stream',
        });

      if (uploadError) {
        setStage(null);
        setError(`تعذّر رفع الملف إلى التخزين: ${uploadError.message}`);
        return;
      }

      setStage('جارٍ التحليل وإضافته إلى قاعدة المعرفة…');

      formData.set('storagePath', ticket.ticket.path);
      formData.set('fileType', file.type || '');
      // الملف نفسه لا يُرسل إلى الخادم — رُفع من هنا مباشرةً
      formData.delete('file');

      const finalized = await finalizeUploadAction(formData);
      const result = await driveProcessing(finalized, (done, total) =>
        setStage(`الملف ممسوح ضوئيًا — جارٍ قراءته: ${done} من ${total} صفحة…`),
      );
      setStage(null);

      if (!result.ok) {
        setError(result.message ?? 'تعذّر رفع المستند.');
        return;
      }

      toast.success(result.message ?? 'تم رفع المستند.');
      setIsOpen(false);
      reset();
      router.refresh();
    });
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Upload className="size-4" aria-hidden />
          رفع مستند
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>رفع مستند جديد</DialogTitle>
          <DialogDescription>
            سيُستخرج نص المستند ويُفهرس تلقائيًا ليصبح قابلًا للسؤال عنه.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={submit} className="space-y-5">
          {error ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : null}

          {/* اختيار الملف */}
          <div className="space-y-2">
            <Label htmlFor="file">الملف *</Label>
            {file ? (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                <FileUp className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => pickFile(null)}
                  aria-label="إزالة الملف"
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            ) : (
              <label
                htmlFor="file"
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <FileUp className="size-6 text-muted-foreground" aria-hidden />
                <span className="mt-2 text-sm font-medium">اختر ملفًا أو اسحبه هنا</span>
                <span className="mt-1 text-xs text-muted-foreground">
                  PDF · DOCX · XLSX · CSV · TXT — حتى {formatBytes(MAX_BYTES)}
                </span>
              </label>
            )}
            <input
              id="file"
              name="file"
              type="file"
              accept={ACCEPTED}
              className="sr-only"
              onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">اسم المستند *</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={200}
              placeholder="مثال: سياسة الإجازات 2026"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoryId">التصنيف</Label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue=""
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">بدون تصنيف</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">وصف مختصر</Label>
            <Textarea id="description" name="description" rows={2} maxLength={1000} />
          </div>

          {/* الصلاحيات */}
          <div className="space-y-2">
            <Label htmlFor="visibility">من يستطيع الوصول؟ *</Label>
            <Select
              value={visibility}
              onValueChange={(value) => setVisibility(value as DocumentVisibility)}
            >
              <SelectTrigger id="visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="COMPANY">جميع موظفي الشركة</SelectItem>
                <SelectItem value="DEPARTMENT">أقسام محددة</SelectItem>
                <SelectItem value="ROLE">أدوار محددة</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs leading-relaxed text-muted-foreground">
              مدير الشركة يرى كل المستندات في جميع الأحوال.
            </p>
          </div>

          {visibility === 'DEPARTMENT' ? (
            <fieldset className="space-y-2 rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">الأقسام المسموح لها</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {departments.map((department) => (
                  <label key={department.id} className="flex items-center gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-input accent-[hsl(var(--primary))]"
                      checked={selectedDepartments.includes(department.id)}
                      onChange={(event) =>
                        setSelectedDepartments((current) =>
                          event.target.checked
                            ? [...current, department.id]
                            : current.filter((id) => id !== department.id),
                        )
                      }
                    />
                    {department.name}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {visibility === 'ROLE' ? (
            <fieldset className="space-y-2 rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">الأدوار المسموح لها</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {ASSIGNABLE_ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-input accent-[hsl(var(--primary))]"
                      checked={selectedRoles.includes(role)}
                      onChange={(event) =>
                        setSelectedRoles((current) =>
                          event.target.checked
                            ? [...current, role]
                            : current.filter((item) => item !== role),
                        )
                      }
                    />
                    {ROLE_LABELS[role]}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <DialogFooter>
            <Button type="submit" loading={isPending} disabled={!file}>
              {isPending ? (stage ?? 'جاري الرفع…') : 'رفع ومعالجة'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isPending}
            >
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
