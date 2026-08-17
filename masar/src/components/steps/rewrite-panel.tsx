'use client';

import * as React from 'react';
import { Download, FileDown, GitCompare, Mail, Printer, User } from 'lucide-react';
import { toast } from 'sonner';
import { CopyButton } from '@/components/copy-button';
import { CvSheet, printCv } from '@/components/cv-sheet';
import { DiffView } from '@/components/diff-view';
import { Badge, Button, Card, CardTitle } from '@/components/ui/primitives';
import type { CvRewrite } from '@/lib/ai/schemas';

type TabId = 'cv' | 'diff' | 'changes' | 'letter' | 'linkedin';

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'cv', label: 'السيرة المعدّلة', icon: <FileDown className="size-4" /> },
  { id: 'diff', label: 'قبل / بعد', icon: <GitCompare className="size-4" /> },
  { id: 'changes', label: 'ماذا تغيّر ولماذا', icon: <GitCompare className="size-4" /> },
  { id: 'letter', label: 'رسالة التقديم', icon: <Mail className="size-4" /> },
  { id: 'linkedin', label: 'حول — لينكدإن', icon: <User className="size-4" /> },
];

export function RewritePanel({
  rewrite,
  originalCv,
  exporting,
  onExportDocx,
}: {
  rewrite: CvRewrite;
  originalCv: string;
  exporting: boolean;
  onExportDocx: () => void;
}) {
  const [tab, setTab] = React.useState<TabId>('cv');

  return (
    <Card>
      <CardTitle icon={<FileDown className="size-5 text-primary" />} hint="الخطوة ٣ من ٣">
        النتيجة
      </CardTitle>

      <div className="mb-5 flex flex-wrap gap-2">
        <Button size="sm" loading={exporting} onClick={onExportDocx}>
          <Download className="size-4" />
          تنزيل Word
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            if (!printCv(rewrite.improvedCv)) {
              toast.error('منع المتصفح فتح نافذة الطباعة. اسمح بالنوافذ المنبثقة وأعد المحاولة.');
            }
          }}
        >
          <Printer className="size-4" />
          طباعة / حفظ PDF
        </Button>
        <CopyButton value={rewrite.improvedCv} label="نسخ نصّ السيرة" />
      </div>

      <div
        role="tablist"
        aria-label="مخرجات الوكيل"
        className="mb-5 flex flex-wrap gap-1 border-b border-border"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`focus-ring -mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === item.id
                ? 'border-primary font-semibold text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'cv' && <CvSheet text={rewrite.improvedCv} />}

      {tab === 'diff' && <DiffView before={originalCv} after={rewrite.improvedCv} />}

      {tab === 'changes' && (
        <ul className="space-y-4">
          {rewrite.changes.map((change, index) => (
            <li key={index} className="rounded-md border border-border p-4">
              <Badge tone="primary" className="mb-2">
                {change.area}
              </Badge>
              <p className="text-sm text-muted-foreground line-through decoration-destructive/40">
                {change.before}
              </p>
              <p className="mt-1 text-sm font-medium">{change.after}</p>
              <p className="mt-2 text-xs text-muted-foreground">{change.why}</p>
            </li>
          ))}
        </ul>
      )}

      {tab === 'letter' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <CopyButton value={rewrite.coverLetter} />
          </div>
          <p className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-5 text-sm leading-8">
            {rewrite.coverLetter}
          </p>
        </div>
      )}

      {tab === 'linkedin' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <CopyButton value={rewrite.linkedinAbout} />
          </div>
          <p className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-5 text-sm leading-8">
            {rewrite.linkedinAbout}
          </p>
        </div>
      )}

      {rewrite.remainingAdvice.length > 0 && (
        <div className="mt-6 rounded-md border border-warning/40 bg-warning/5 p-4">
          <h3 className="mb-2 text-sm font-bold text-warning">
            ما لا تحلّه إعادة الكتابة — يحتاج فعلًا منك
          </h3>
          <ul className="list-disc space-y-1 pe-5 text-sm leading-7">
            {rewrite.remainingAdvice.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
