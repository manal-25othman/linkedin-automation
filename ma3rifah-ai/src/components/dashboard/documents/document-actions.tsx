'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, Download, MoreVertical, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  archiveDocumentAction,
  deleteDocumentAction,
  getDocumentDownloadUrl,
  reprocessDocumentAction,
} from '@/app/(dashboard)/documents/actions';
import type { DocumentStatus } from '@/types/database';
import { driveProcessing } from './processing-loop';

export function DocumentRowActions({
  documentId,
  documentName,
  status,
  canManage,
}: {
  documentId: string;
  documentName: string;
  status: DocumentStatus;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const download = () => {
    startTransition(async () => {
      const result = await getDocumentDownloadUrl(documentId);
      if (!result.ok || !result.url) {
        toast.error(result.message ?? 'تعذّر تنزيل الملف.');
        return;
      }
      window.open(result.url, '_blank', 'noopener,noreferrer');
    });
  };

  const reprocess = () => {
    startTransition(async () => {
      const first = await reprocessDocumentAction(documentId);
      let progressToast: string | number | undefined;
      const result = await driveProcessing(first, (done, total) => {
        progressToast = toast.loading(`جارٍ القراءة الضوئية: ${done} من ${total} صفحة…`, {
          id: progressToast,
        });
        router.refresh();
      });
      if (progressToast !== undefined) toast.dismiss(progressToast);
      toast[result.ok ? 'success' : 'error'](
        result.message ?? (result.ok ? 'بدأت المعالجة.' : 'تعذّر تنفيذ العملية.'),
      );
      router.refresh();
    });
  };

  const archive = () => {
    startTransition(async () => {
      const result = await archiveDocumentAction(documentId);
      toast[result.ok ? 'success' : 'error'](result.message ?? 'تعذّر تنفيذ العملية.');
      router.refresh();
    });
  };

  const remove = () => {
    const confirmed = window.confirm(
      `سيُحذف «${documentName}» نهائيًا مع كل مقاطعه المفهرسة، ولن يعود المساعد يجيب منه.\n\nهل تريد المتابعة؟`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteDocumentAction(documentId);
      toast[result.ok ? 'success' : 'error'](result.message ?? 'تعذّر الحذف.');
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        aria-label={`خيارات ${documentName}`}
        disabled={isPending}
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={download}>
          <Download aria-hidden />
          تنزيل الملف الأصلي
        </DropdownMenuItem>

        {canManage ? (
          <>
            {status === 'FAILED' || status === 'READY' || status === 'PROCESSING' ? (
              <DropdownMenuItem onSelect={reprocess}>
                <RefreshCw aria-hidden />
                {status === 'FAILED'
                  ? 'إعادة المحاولة'
                  : status === 'PROCESSING'
                    ? 'متابعة المعالجة'
                    : 'إعادة الفهرسة'}
              </DropdownMenuItem>
            ) : null}

            {status !== 'ARCHIVED' ? (
              <DropdownMenuItem onSelect={archive}>
                <Archive aria-hidden />
                أرشفة
              </DropdownMenuItem>
            ) : null}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={remove}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 aria-hidden />
              حذف نهائيًا
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
