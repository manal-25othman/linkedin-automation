import type { CvAnalysis, CvRewrite, JobBrief } from '@/lib/ai/schemas';

/** كيف وصلنا إلى نصّ الإعلان — يُعرض للمستخدم ليعرف مدى اكتمال ما قُرئ */
export type PostingSource = 'linkedin-guest' | 'structured' | 'page' | 'manual';

export interface JobPosting {
  text: string;
  source: PostingSource;
  url?: string;
  title?: string;
  company?: string;
  location?: string;
}

export interface JobResponse {
  posting: JobPosting;
  brief: JobBrief;
}

export interface CvResponse {
  fileName: string;
  pageCount: number | null;
  text: string;
}

export interface AnalyzeResponse {
  analysis: CvAnalysis;
}

export interface RewriteResponse {
  rewrite: CvRewrite;
}

export type CvLanguageChoice = 'auto' | 'ar' | 'en';

export const SOURCE_LABELS: Record<PostingSource, string> = {
  'linkedin-guest': 'قُرئ من لينكدإن',
  structured: 'قُرئ من بيانات الوظيفة المهيكلة',
  page: 'قُرئ من نصّ الصفحة',
  manual: 'نصّ ملصوق يدويًا',
};
