'use client';

import * as React from 'react';
import { RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { AnalysisPanel } from '@/components/steps/analysis-panel';
import { BriefPanel } from '@/components/steps/brief-panel';
import { CvStep, type CvStage } from '@/components/steps/cv-step';
import { JobStep, type JobSubmission } from '@/components/steps/job-step';
import { RewritePanel } from '@/components/steps/rewrite-panel';
import { Button } from '@/components/ui/primitives';
import type { CvAnalysis, CvRewrite, JobBrief } from '@/lib/ai/schemas';
import { ApiError, messageOf, postForBlob, postForm, postJson } from '@/lib/api-client';
import { cvFileName, parseCv } from '@/lib/cv-format';
import type {
  AnalyzeResponse,
  CvLanguageChoice,
  CvResponse,
  JobPosting,
  JobResponse,
  RewriteResponse,
} from '@/lib/types';

/**
 * منظّم الخطوات الثلاث.
 *
 * الحالة كلها هنا في الذاكرة ولا تُحفظ في أي مكان: لا خادم ولا localStorage.
 * إعادة تحميل الصفحة تبدأ من الصفر — وهو الثمن المقبول مقابل ألّا تبقى
 * سيرة ذاتية في جهاز مشترك بعد إغلاق التبويب.
 */
export function CareerAgent() {
  const [jobLoading, setJobLoading] = React.useState(false);
  const [blockedMessage, setBlockedMessage] = React.useState<string | null>(null);
  const [posting, setPosting] = React.useState<JobPosting | null>(null);
  const [brief, setBrief] = React.useState<JobBrief | null>(null);

  const [stage, setStage] = React.useState<CvStage>('idle');
  const [language, setLanguage] = React.useState<CvLanguageChoice>('auto');
  const [originalCv, setOriginalCv] = React.useState('');
  const [analysis, setAnalysis] = React.useState<CvAnalysis | null>(null);
  const [rewrite, setRewrite] = React.useState<CvRewrite | null>(null);
  const [exporting, setExporting] = React.useState(false);

  const resultRef = React.useRef<HTMLDivElement>(null);

  async function handleJobSubmit(submission: JobSubmission) {
    setJobLoading(true);
    setBlockedMessage(null);

    try {
      const data = await postJson<JobResponse>('/api/job', submission);
      setPosting(data.posting);
      setBrief(data.brief);
      // تصفير مخرجات السيرة: تحليل مبنيّ على وظيفة سابقة يضلّل إن بقي معروضًا
      setAnalysis(null);
      setRewrite(null);
      window.setTimeout(
        () => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        60,
      );
    } catch (error) {
      if (error instanceof ApiError && error.code === 'JOB_BLOCKED') {
        setBlockedMessage(error.message);
      } else {
        toast.error(messageOf(error));
      }
    } finally {
      setJobLoading(false);
    }
  }

  async function handleCvSubmit(file: File) {
    if (!posting || !brief) return;

    try {
      setStage('extracting');
      const form = new FormData();
      form.append('file', file);
      const extracted = await postForm<CvResponse>('/api/cv', form);
      setOriginalCv(extracted.text);

      setStage('analyzing');
      const analyzed = await postJson<AnalyzeResponse>('/api/analyze', {
        jobText: posting.text,
        jobBrief: brief,
        cvText: extracted.text,
      });
      setAnalysis(analyzed.analysis);

      setStage('rewriting');
      const rewritten = await postJson<RewriteResponse>('/api/rewrite', {
        jobText: posting.text,
        jobBrief: brief,
        cvText: extracted.text,
        analysis: analyzed.analysis,
        language,
      });
      setRewrite(rewritten.rewrite);
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setStage('idle');
    }
  }

  async function handleExportDocx() {
    if (!rewrite) return;
    setExporting(true);

    try {
      const blob = await postForBlob('/api/export/docx', { cvText: rewrite.improvedCv });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = cvFileName(parseCv(rewrite.improvedCv), 'docx');
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // الإفراج مؤجَّل: الإفراج الفوري يُلغي التنزيل في بعض المتصفحات
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setExporting(false);
    }
  }

  function handleReset() {
    setPosting(null);
    setBrief(null);
    setAnalysis(null);
    setRewrite(null);
    setOriginalCv('');
    setBlockedMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="space-y-6">
      <JobStep loading={jobLoading} blockedMessage={blockedMessage} onSubmit={handleJobSubmit} />

      <div ref={resultRef} className="space-y-6">
        {posting && brief && (
          <>
            <div className="animate-fade-up">
              <BriefPanel posting={posting} brief={brief} />
            </div>

            <div className="animate-fade-up">
              <CvStep
                stage={stage}
                language={language}
                onLanguageChange={setLanguage}
                onSubmit={handleCvSubmit}
              />
            </div>
          </>
        )}

        {analysis && (
          <div className="animate-fade-up">
            <AnalysisPanel analysis={analysis} />
          </div>
        )}

        {rewrite && (
          <div className="animate-fade-up">
            <RewritePanel
              rewrite={rewrite}
              originalCv={originalCv}
              exporting={exporting}
              onExportDocx={handleExportDocx}
            />
          </div>
        )}

        {posting && (
          <div className="flex justify-center pb-4">
            <Button variant="ghost" onClick={handleReset}>
              <RotateCcw className="size-4" />
              ابدأ بوظيفة أخرى
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
