'use client';

import * as React from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { Button, Card, CardTitle, Field } from '@/components/ui/primitives';
import type { CvLanguageChoice } from '@/lib/types';

const ACCEPTED = '.pdf,.docx,.txt,.md';

const LANGUAGE_OPTIONS: Array<{ value: CvLanguageChoice; label: string }> = [
  { value: 'auto', label: 'كما هي' },
  { value: 'ar', label: 'العربية' },
  { value: 'en', label: 'الإنجليزية' },
];

/** الحالة المعروضة أثناء المعالجة الطويلة — ثلاث مراحل متتابعة */
export type CvStage = 'idle' | 'extracting' | 'analyzing' | 'rewriting';

const STAGE_LABELS: Record<Exclude<CvStage, 'idle'>, string> = {
  extracting: 'يقرأ ملف السيرة…',
  analyzing: 'يقارنها بمتطلبات الوظيفة…',
  rewriting: 'يعيد كتابتها ويكتب رسالة التقديم…',
};

export function CvStep({
  stage,
  language,
  onLanguageChange,
  onSubmit,
}: {
  stage: CvStage;
  language: CvLanguageChoice;
  onLanguageChange: (language: CvLanguageChoice) => void;
  onSubmit: (file: File) => void;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const busy = stage !== 'idle';

  return (
    <Card>
      <CardTitle icon={<FileText className="size-5 text-primary" />} hint="الخطوة ٢ من ٣">
        سيرتك الذاتية
      </CardTitle>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (busy) return;
          const dropped = event.dataTransfer.files?.[0];
          if (dropped) setFile(dropped);
        }}
        className={`rounded-md border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? 'border-primary bg-accent' : 'border-border bg-muted/30'
        }`}
      >
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileText className="size-5 text-primary" />
            <span className="text-sm font-medium">{file.name}</span>
            {!busy && (
              <button
                type="button"
                aria-label="إزالة الملف"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => {
                  setFile(null);
                  if (inputRef.current) inputRef.current.value = '';
                }}
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        ) : (
          <>
            <Upload className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="text-sm font-medium">اسحب الملف هنا، أو</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              اختر ملفًا
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              PDF أو DOCX أو TXT — حتى ١٠ ميجابايت
            </p>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) setFile(selected);
          }}
        />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 sm:items-end">
        <Field label="لغة السيرة بعد التعديل">
          <select
            className="focus-ring h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
            value={language}
            disabled={busy}
            onChange={(event) => onLanguageChange(event.target.value as CvLanguageChoice)}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Button
          size="lg"
          loading={busy}
          disabled={!file}
          onClick={() => file && onSubmit(file)}
        >
          حلّل السيرة وأعد كتابتها
        </Button>
      </div>

      {stage !== 'idle' && (
        <p className="mt-4 text-sm text-muted-foreground">
          {STAGE_LABELS[stage]} قد يستغرق هذا دقيقة أو دقيقتين — لا تغلق الصفحة.
        </p>
      )}

      <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
        الملف لا يُحفظ على الخادم: يُقرأ نصّه في الذاكرة ثم يُهمل. لا قاعدة بيانات ولا تخزين.
      </p>
    </Card>
  );
}
