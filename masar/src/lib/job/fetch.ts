import 'server-only';

import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { assertPublicUrl } from '@/lib/job/url-guard';
import {
  extractJobPosting,
  htmlToText,
  trimJobText,
  type StructuredJob,
} from '@/lib/job/html';

const FETCH_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 4;
/** سقف حجم الجسم المقروء — صفحة إعلان لا تتجاوزه، وما تجاوزه يُقطع */
const MAX_BODY_BYTES = 3 * 1024 * 1024;

/**
 * ترويسة متصفّح حقيقية.
 *
 * كثير من مواقع التوظيف تُرجع صفحة فارغة أو 403 للطلبات بلا User-Agent.
 * هذا ليس تحايلًا على منع: المواقع التي تمنع فعلًا تُرجع 999 أو جدار
 * تسجيل دخول، ويُعامَل ذلك صراحةً بالأسفل.
 */
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ar,en;q=0.8',
};

/** يقرأ الجسم بسقف حجم — استجابة بلا نهاية لا تستهلك ذاكرة الخادم */
async function readCapped(response: Response): Promise<string> {
  const body = response.body;
  if (!body) return '';

  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  const chunks: string[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      chunks.push(decoder.decode(value, { stream: true }));
      if (total >= MAX_BODY_BYTES) break;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  chunks.push(decoder.decode());
  return chunks.join('');
}

export interface FetchedPage {
  finalUrl: string;
  status: number;
  body: string;
  contentType: string;
}

/**
 * جلب آمن: كل قفزة إعادة توجيه تُفحص من جديد.
 *
 * إعادة التوجيه هي الثغرة المعتادة في حرّاس SSRF: رابط عام يُعيد التوجيه
 * إلى 169.254.169.254. لذلك redirect: 'manual' والفحص في كل قفزة.
 */
export async function safeFetch(
  rawUrl: string,
  headers: Record<string, string> = BROWSER_HEADERS,
): Promise<FetchedPage> {
  let current = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = await assertPublicUrl(current);

    let response: Response;
    try {
      response = await fetch(url, {
        headers,
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cache: 'no-store',
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new AppError(
        'JOB_FETCH_FAILED',
        'تعذّر الوصول إلى الرابط. تأكد منه أو الصق نص الوظيفة يدويًا.',
        reason,
      );
    }

    const isRedirect = response.status >= 300 && response.status < 400;
    const location = response.headers.get('location');
    if (isRedirect && location) {
      current = new URL(location, url).toString();
      await response.body?.cancel().catch(() => undefined);
      continue;
    }

    return {
      finalUrl: url.toString(),
      status: response.status,
      body: await readCapped(response),
      contentType: response.headers.get('content-type') ?? '',
    };
  }

  throw new AppError('JOB_FETCH_FAILED', 'الرابط يُعيد التوجيه أكثر مما ينبغي.');
}

/** معرّف وظيفة لينكدإن من أي من صيغتَي الرابط الشائعتين */
export function linkedInJobId(rawUrl: string): string | null {
  const byPath = /\/jobs\/view\/(?:[^/?#]*-)?(\d{6,})/.exec(rawUrl);
  if (byPath?.[1]) return byPath[1];

  try {
    const url = new URL(rawUrl);
    const byQuery = url.searchParams.get('currentJobId');
    if (byQuery && /^\d{6,}$/.test(byQuery)) return byQuery;
  } catch {
    return null;
  }

  return null;
}

/**
 * تصنيف الاستجابة.
 *
 * الفرق بين «الصفحة غير موجودة» و«الموقع يمنع القراءة» ليس تجميليًا: الأول
 * يعني أن الرابط خطأ فيراجعه المستخدم، والثاني يعني أن الرابط صحيح ولا
 * سبيل إلا اللصق اليدوي. خلطهما يرسل المستخدم في الاتجاه الخطأ.
 */
export type PageVerdict = 'ok' | 'blocked' | 'not-found' | 'failed';

export function classify(page: FetchedPage): PageVerdict {
  if (page.status === 404 || page.status === 410) return 'not-found';
  // 999 رمز غير قياسي تستعمله لينكدإن تحديدًا لصدّ القراءة الآلية
  if (page.status === 401 || page.status === 403 || page.status === 429 || page.status === 999) {
    return 'blocked';
  }
  if (page.status >= 400) return 'failed';
  if (/authwall|\/uas\/login|please log in to continue/i.test(page.body.slice(0, 4000))) {
    return 'blocked';
  }
  return 'ok';
}

const NOT_FOUND_ERROR = () =>
  new AppError(
    'JOB_FETCH_FAILED',
    'الصفحة غير موجودة (404). تأكد من الرابط — قد يكون الإعلان أُغلق أو حُذف.',
  );

export interface JobPostingResult {
  url: string;
  /** من أين جاء النص — يُعرض للمستخدم ليعرف مدى اكتمال ما قُرئ */
  source: 'linkedin-guest' | 'structured' | 'page';
  text: string;
  title?: string;
  company?: string;
  location?: string;
}

function buildResult(url: string, source: JobPostingResult['source'], job: StructuredJob | null, fallbackText: string): JobPostingResult {
  const text = job
    ? [
        job.title ? `المسمّى: ${job.title}` : '',
        job.company ? `الشركة: ${job.company}` : '',
        job.location ? `الموقع: ${job.location}` : '',
        job.employmentType ? `نوع التوظيف: ${job.employmentType}` : '',
        '',
        job.description,
      ]
        .filter(Boolean)
        .join('\n')
    : fallbackText;

  return {
    url,
    source,
    text: trimJobText(text),
    title: job?.title,
    company: job?.company,
    location: job?.location,
  };
}

/**
 * يقرأ إعلان الوظيفة من رابط.
 *
 * لينكدإن أولًا عبر واجهة الضيف: صفحة الوظيفة العادية تُرجع جدار تسجيل دخول
 * لأي زائر غير مسجَّل، بينما `jobs-guest` هي الواجهة العلنية نفسها التي
 * تستعملها بطاقات الوظائف المضمَّنة في المواقع. وإن فشلت أيضًا، يُطلب من
 * المستخدم لصق النص — ولا يُحاوَل الالتفاف على المنع.
 */
export async function fetchJobPosting(rawUrl: string): Promise<JobPostingResult> {
  const jobId = linkedInJobId(rawUrl);

  if (jobId) {
    // فشل الشبكة يُمرَّر كما هو: الادّعاء بأن لينكدإن «منع» القراءة بينما
    // الخادم بلا اتصال يرسل المستخدم إلى حلّ لا يخصّ مشكلته.
    const guest = await safeFetch(
      `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`,
    );

    const verdict = classify(guest);
    if (verdict === 'not-found') throw NOT_FOUND_ERROR();

    if (verdict === 'ok') {
      const text = htmlToText(guest.body);
      if (text.length >= 200) {
        return buildResult(rawUrl, 'linkedin-guest', extractJobPosting(guest.body), text);
      }
    }

    logger.warn('لينكدإن لم يُرجع إعلانًا قابلًا للقراءة', { status: guest.status, verdict });

    throw new AppError(
      'JOB_BLOCKED',
      'لينكدإن يمنع قراءة هذا الإعلان بدون تسجيل دخول. افتح الإعلان وانسخ نصّه، ثم الصقه في الحقل بالأسفل — النتيجة نفسها تمامًا.',
    );
  }

  const page = await safeFetch(rawUrl);
  const verdict = classify(page);

  if (verdict === 'not-found') throw NOT_FOUND_ERROR();

  if (verdict === 'failed') {
    throw new AppError(
      'JOB_FETCH_FAILED',
      `الموقع ردّ بخطأ (${page.status}). حاول لاحقًا أو الصق نص الإعلان يدويًا.`,
    );
  }

  if (verdict === 'blocked') {
    throw new AppError(
      'JOB_BLOCKED',
      'الموقع يطلب تسجيل دخول أو يمنع القراءة الآلية. انسخ نص الإعلان والصقه في الحقل بالأسفل.',
    );
  }

  if (!/text\/html|application\/(xhtml|json)/i.test(page.contentType) && page.contentType) {
    throw new AppError('VALIDATION', 'الرابط لا يشير إلى صفحة وظيفة.');
  }

  const structured = extractJobPosting(page.body);
  const text = htmlToText(page.body);

  if (!structured && text.length < 200) {
    throw new AppError(
      'JOB_BLOCKED',
      'الصفحة لا تحتوي نصًّا كافيًا (غالبًا تُبنى بجافاسكربت). الصق نص الإعلان يدويًا.',
    );
  }

  return buildResult(page.finalUrl, structured ? 'structured' : 'page', structured, text);
}
