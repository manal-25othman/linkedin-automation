import { AlertTriangle, Archive, CheckCircle2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { DocumentStatus } from '@/types/database';

const STATUS_CONFIG: Record<
  DocumentStatus,
  { label: string; variant: 'success' | 'warning' | 'destructive' | 'muted'; icon: typeof CheckCircle2 }
> = {
  READY: { label: 'جاهز', variant: 'success', icon: CheckCircle2 },
  PROCESSING: { label: 'جاري التحليل', variant: 'warning', icon: Loader2 },
  FAILED: { label: 'فشل', variant: 'destructive', icon: AlertTriangle },
  ARCHIVED: { label: 'مؤرشف', variant: 'muted', icon: Archive },
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant}>
      <Icon
        className={status === 'PROCESSING' ? 'size-3 animate-spin' : 'size-3'}
        aria-hidden
      />
      {config.label}
    </Badge>
  );
}

export const VISIBILITY_LABELS = {
  COMPANY: 'الشركة كاملة',
  DEPARTMENT: 'أقسام محددة',
  ROLE: 'أدوار محددة',
} as const;
