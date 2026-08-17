'use client';

import { CircleAlert, Gauge, ListChecks, ScanLine, Sparkles, TriangleAlert } from 'lucide-react';
import { CopyButton } from '@/components/copy-button';
import { Badge, Card, CardTitle } from '@/components/ui/primitives';
import type { CvAnalysis } from '@/lib/ai/schemas';

function scoreTone(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 75) return 'success';
  if (score >= 50) return 'warning';
  return 'danger';
}

const TONE_BAR: Record<'success' | 'warning' | 'danger', string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
};

function ScoreBar({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={`الدرجة ${clamped} من 100`}
    >
      <div
        className={`h-full rounded-full transition-[width] ${TONE_BAR[scoreTone(clamped)]}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function AnalysisPanel({ analysis }: { analysis: CvAnalysis }) {
  const score = Math.max(0, Math.min(100, Math.round(analysis.matchScore)));

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle icon={<Gauge className="size-5 text-primary" />}>درجة المطابقة</CardTitle>

        <div className="flex items-end gap-4">
          <span className="tabular text-5xl font-extrabold leading-none">{score}</span>
          <span className="pb-2 text-sm text-muted-foreground">من ١٠٠</span>
          <Badge tone={scoreTone(score)} className="mb-1 ms-auto">
            {score >= 75 ? 'مرشّح قوي' : score >= 50 ? 'يحتاج تعديلًا' : 'فجوة كبيرة'}
          </Badge>
        </div>

        <div className="mt-3">
          <ScoreBar score={score} />
        </div>

        <p className="mt-4 text-sm leading-7">{analysis.verdict}</p>

        <div className="mt-5 space-y-3">
          {analysis.scoreBreakdown.map((item, index) => (
            <div key={index}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{item.label}</span>
                <span className="tabular text-muted-foreground">
                  {Math.round(item.score)}٪
                </span>
              </div>
              <ScoreBar score={item.score} />
              <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
            </div>
          ))}
        </div>
      </Card>

      {analysis.quickWins.length > 0 && (
        <Card className="border-primary/30 bg-accent/40">
          <CardTitle icon={<Sparkles className="size-5 text-primary" />} hint="مرتّبة بالأثر">
            تعديلات سريعة عالية الأثر
          </CardTitle>
          <ol className="list-decimal space-y-2 pe-5 text-sm leading-7">
            {analysis.quickWins.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ol>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle icon={<ListChecks className="size-5 text-success" />}>نقاط قوّتك</CardTitle>
          <ul className="list-disc space-y-2 pe-5 text-sm leading-7">
            {analysis.strengths.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle icon={<TriangleAlert className="size-5 text-warning" />}>الفجوات</CardTitle>
          <ul className="space-y-4">
            {analysis.gaps.map((gap, index) => (
              <li key={index} className="border-s-2 border-warning/50 ps-3">
                <p className="font-semibold">{gap.gap}</p>
                <p className="text-sm text-muted-foreground">{gap.whyItMatters}</p>
                <p className="mt-1 text-sm">
                  <span className="font-medium text-success">الحل: </span>
                  {gap.howToFix}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {analysis.missingKeywords.length > 0 && (
        <Card>
          <CardTitle
            icon={<ScanLine className="size-5 text-primary" />}
            hint="أضفها حيث تكون صادقة على خبرتك"
          >
            كلمات مفتاحية غائبة عن سيرتك
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            {analysis.missingKeywords.map((keyword, index) => (
              <Badge key={index} tone="warning">
                {keyword}
              </Badge>
            ))}
          </div>
          <div className="mt-4">
            <CopyButton value={analysis.missingKeywords.join('، ')} label="نسخ الكل" />
          </div>
        </Card>
      )}

      {analysis.atsIssues.length > 0 && (
        <Card>
          <CardTitle icon={<CircleAlert className="size-5 text-destructive" />}>
            ما يعيق أنظمة التتبّع عن قراءة سيرتك
          </CardTitle>
          <ul className="list-disc space-y-1 pe-5 text-sm leading-7">
            {analysis.atsIssues.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </Card>
      )}

      {analysis.sectionFeedback.length > 0 && (
        <Card>
          <CardTitle icon={<ListChecks className="size-5 text-primary" />}>
            ملاحظات على الأقسام
          </CardTitle>
          <div className="divide-y divide-border">
            {analysis.sectionFeedback.map((item, index) => (
              <div key={index} className="py-3 first:pt-0 last:pb-0">
                <p className="font-semibold">{item.section}</p>
                <p className="text-sm text-muted-foreground">{item.issue}</p>
                <p className="mt-1 text-sm">
                  <span className="font-medium text-primary">المقترح: </span>
                  {item.suggestion}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
