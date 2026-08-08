'use client';

import { useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface CrudDialogResult {
  ok: boolean;
  message?: string;
}

/**
 * حوار عام لنماذج الإنشاء والتعديل.
 *
 * يوحّد سلوك عرض الأخطاء، حالة الإرسال، وتحديث الصفحة بعد النجاح،
 * حتى لا يتكرر هذا المنطق في كل شاشة إدارية.
 */
export function CrudDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  action,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  action: (formData: FormData) => Promise<CrudDialogResult>;
  children: ReactNode;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const submit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) {
        setError(result.message ?? 'تعذّر إتمام العملية.');
        return;
      }
      toast.success(result.message ?? 'تم الحفظ.');
      onOpenChange(false);
      formRef.current?.reset();
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setError(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
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

          {children}

          <DialogFooter>
            <Button type="submit" loading={isPending}>
              {submitLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
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

/** زر يستدعي إجراءً على الخادم مع تأكيد اختياري */
export function ActionButton({
  action,
  confirmMessage,
  children,
  className,
  variant = 'ghost',
  size = 'sm',
}: {
  action: () => Promise<CrudDialogResult>;
  confirmMessage?: string;
  children: ReactNode;
  className?: string;
  variant?: 'ghost' | 'outline' | 'destructive' | 'default' | 'secondary';
  size?: 'sm' | 'default' | 'icon-sm';
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const run = () => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    startTransition(async () => {
      const result = await action();
      toast[result.ok ? 'success' : 'error'](result.message ?? 'تعذّر إتمام العملية.');
      if (result.ok) router.refresh();
    });
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={run}
      loading={isPending}
    >
      {children}
    </Button>
  );
}
