import 'server-only';

import { generateStructured } from '@/lib/ai/client';
import { JOB_BRIEF_SYSTEM_PROMPT, wrapUntrusted } from '@/lib/ai/prompts';
import { jobBriefSchema, type JobBrief } from '@/lib/ai/schemas';

export async function buildJobBrief(params: {
  jobText: string;
  sourceUrl?: string;
}): Promise<JobBrief> {
  const context = params.sourceUrl ? `مصدر الإعلان: ${params.sourceUrl}` : 'الإعلان مُلصق يدويًا.';

  const { data } = await generateStructured({
    systemPrompt: JOB_BRIEF_SYSTEM_PROMPT,
    userMessage: [
      context,
      '',
      'حلّل الإعلان التالي وأخرج الملخّص العملي ونصائح التقديم والمسودّات القابلة للنسخ.',
      '',
      wrapUntrusted('job_posting', params.jobText),
    ].join('\n'),
    schema: jobBriefSchema,
    // الملخّص أقصر بكثير من إعادة كتابة السيرة، فسقف أضيق يكفي
    maxTokens: 16_000,
    label: 'job-brief',
  });

  return data;
}
