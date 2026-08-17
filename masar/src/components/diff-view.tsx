'use client';

import * as React from 'react';
import { diffLines, diffStats } from '@/lib/diff';
import { Badge } from '@/components/ui/primitives';

const KIND_STYLES = {
  added: 'border-success bg-success/10',
  removed: 'border-destructive bg-destructive/10 line-through decoration-destructive/40',
  same: 'border-transparent',
} as const;

const KIND_MARKS = { added: '+', removed: '−', same: ' ' } as const;

export function DiffView({ before, after }: { before: string; after: string }) {
  const [hideUnchanged, setHideUnchanged] = React.useState(false);

  const lines = React.useMemo(() => diffLines(before, after), [before, after]);
  const stats = React.useMemo(() => diffStats(lines), [lines]);
  const visible = hideUnchanged ? lines.filter((line) => line.kind !== 'same') : lines;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="success">أُضيف {stats.added} سطرًا</Badge>
        <Badge tone="danger">حُذف {stats.removed} سطرًا</Badge>
        <Badge>بقي {stats.unchanged} سطرًا كما هو</Badge>
        <label className="ms-auto flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="size-3.5 accent-[hsl(var(--primary))]"
            checked={hideUnchanged}
            onChange={(event) => setHideUnchanged(event.target.checked)}
          />
          إخفاء الأسطر غير المتغيّرة
        </label>
      </div>

      <div className="max-h-[32rem] overflow-y-auto rounded-md border border-border bg-card">
        {visible.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">لا فروق تُعرض.</p>
        ) : (
          <ul className="divide-y divide-border/60 text-sm leading-7">
            {visible.map((line, index) => (
              <li
                key={`${line.kind}-${index}`}
                className={`flex gap-2 border-s-4 px-3 py-1 ${KIND_STYLES[line.kind]}`}
              >
                <span
                  aria-hidden
                  className="select-none pt-0.5 font-mono text-xs text-muted-foreground"
                >
                  {KIND_MARKS[line.kind]}
                </span>
                <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                  {line.text || ' '}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
