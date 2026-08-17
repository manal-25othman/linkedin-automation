'use client';

import { AlertTriangle, Briefcase, KeyRound, Lightbulb, MessageSquare, User } from 'lucide-react';
import { CopyButton } from '@/components/copy-button';
import { Badge, Card, CardTitle } from '@/components/ui/primitives';
import type { JobBrief } from '@/lib/ai/schemas';
import { SOURCE_LABELS, type JobPosting } from '@/lib/types';

function DraftBlock({
  title,
  icon,
  value,
  hint,
}: {
  title: string;
  icon: React.ReactNode;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/40 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          {icon}
          {title}
        </h3>
        <CopyButton value={value} />
      </div>
      <p className="whitespace-pre-wrap text-sm leading-7">{value}</p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function BriefPanel({ posting, brief }: { posting: JobPosting; brief: JobBrief }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle
          icon={<Briefcase className="size-5 text-primary" />}
          hint={SOURCE_LABELS[posting.source]}
        >
          {brief.jobTitle}
        </CardTitle>

        <div className="mb-4 flex flex-wrap gap-2">
          <Badge tone="primary">{brief.company}</Badge>
          <Badge>{brief.location}</Badge>
          <Badge>{brief.seniority}</Badge>
          <Badge>{brief.employmentType}</Badge>
        </div>

        <p className="text-sm leading-7 text-muted-foreground">{brief.roleSummary}</p>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-bold">متطلبات إلزامية</h3>
            <ul className="list-disc space-y-1 pe-5 text-sm leading-7">
              {brief.mustHave.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-bold">متطلبات تفضيلية</h3>
            {brief.niceToHave.length === 0 ? (
              <p className="text-sm text-muted-foreground">لم يذكر الإعلان متطلبات تفضيلية.</p>
            ) : (
              <ul className="list-disc space-y-1 pe-5 text-sm leading-7">
                {brief.niceToHave.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle icon={<Lightbulb className="size-5 text-primary" />}>
          كيف تقدّم على هذه الوظيفة
        </CardTitle>
        <ol className="space-y-4">
          {brief.applicationTips.map((tip, index) => (
            <li key={index} className="flex gap-3">
              <span className="tabular mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                {index + 1}
              </span>
              <div>
                <p className="font-semibold">{tip.title}</p>
                <p className="text-sm leading-7 text-muted-foreground">{tip.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <CardTitle
          icon={<KeyRound className="size-5 text-primary" />}
          hint="بصيغتها الحرفية في الإعلان"
        >
          الكلمات المفتاحية لأنظمة التتبّع
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          {brief.atsKeywords.map((keyword, index) => (
            <Badge key={index} tone="primary">
              {keyword}
            </Badge>
          ))}
        </div>
        <div className="mt-4">
          <CopyButton value={brief.atsKeywords.join('، ')} label="نسخ الكل" />
        </div>
      </Card>

      <Card>
        <CardTitle icon={<User className="size-5 text-primary" />}>
          نصوص جاهزة للنسخ
        </CardTitle>
        <div className="space-y-3">
          <DraftBlock
            title="الملخص المهني (أعلى السيرة)"
            icon={<User className="size-4 text-primary" />}
            value={brief.cvSummaryDraft}
            hint="سيُعاد توليده مخصّصًا لخبرتك بعد رفع السيرة."
          />
          <DraftBlock
            title="قسم «حول» في لينكدإن"
            icon={<User className="size-4 text-primary" />}
            value={brief.linkedinAboutDraft}
          />
          <DraftBlock
            title="رسالة لمسؤول التوظيف"
            icon={<MessageSquare className="size-4 text-primary" />}
            value={brief.recruiterMessage}
          />
        </div>
      </Card>

      {brief.watchOuts.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardTitle icon={<AlertTriangle className="size-5 text-warning" />}>
            انتبه في هذا الإعلان
          </CardTitle>
          <ul className="list-disc space-y-1 pe-5 text-sm leading-7">
            {brief.watchOuts.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
