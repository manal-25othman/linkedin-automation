import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { PDFDocument } from 'pdf-lib';
import { serverEnv } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { estimateCostUsd, getAnthropicClient, supportsEffort } from '@/lib/ai/claude';

/**
 * القراءة الضوئية بنموذج الرؤية.
 *
 * الملف الممسوح ضوئيًا صورٌ لا نصّ، وpdf.js لا يجد فيه شيئًا. فتُرسل
 * صفحاته إلى النموذج ليكتب ما يراه حرفيًا — نسخٌ لا فهم: لا تلخيص ولا
 * تصحيح ولا ترجمة، لأن ما يُخزَّن هنا يصير «مصدرًا» يُستشهد به.
 *
 * وتُقرأ على دفعات صغيرة لسببين: سقف رموز الخرج، وعمر الطلب المحدود
 * على الخادم. وكل دفعة تُخزَّن فور اكتمالها فتُستأنف القراءة من حيث
 * توقفت بدل أن تُعاد من أولها.
 */

/** صفحات كل نداء. صفحتان عربيتان كثيفتان ≈ ٢٠٠٠ رمز خرج ≈ ٢٠ ثانية */
export const OCR_PAGES_PER_CALL = 2;

/** سقف خرج النداء — لدفعة من صفحتين، مع هامش للجداول الطويلة */
export const OCR_MAX_OUTPUT_TOKENS = 6000;

/** أنواع الصور المقبولة رفعًا مباشرًا */
export const OCR_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type OcrImageMimeType = (typeof OCR_IMAGE_MIME_TYPES)[number];

export const OCR_SYSTEM_PROMPT = `أنت ناسخ مستندات دقيق. مهمتك نقل النص الظاهر في صور صفحات المستند نصًّا مكتوبًا كما هو حرفيًّا، دون تلخيص أو شرح أو إضافة.

القواعد:
- انسخ كل صفحة كاملة بترتيب قراءتها الطبيعي.
- ابدأ كل صفحة بسطر مستقل بالصيغة التالية تمامًا: === صفحة N === حيث N هو رقم الصفحة المذكور في الطلب.
- الجداول تُنقل صفًّا صفًّا، وتُفصل الخلايا بعلامة |.
- الترويسات والأختام والتواقيع: اكتب نصّها إن كان مقروءًا، ولا تصف الصور ولا الشعارات.
- ما لا يمكن قراءته اكتب مكانه [غير مقروء].
- لا تُصحّح الأخطاء الإملائية ولا تُعِد الصياغة ولا تُترجم؛ الأرقام والتواريخ كما وردت.
- لا تكتب أي شيء خارج نصوص الصفحات: لا مقدمة ولا خاتمة ولا تعليق.`;

export interface OcrPage {
  pageNumber: number;
  text: string;
}

export interface OcrBatchResult {
  pages: OcrPage[];
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  /** بُتر الخرج عند السقف — النص المخزَّن قد يكون ناقصًا */
  truncated: boolean;
}

/** أرقام عربية-هندية في علامة الصفحة تُقبل كما تُقبل اللاتينية */
function toLatinDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

const PAGE_MARKER = /^\s*={2,}\s*صفحة\s*([0-9٠-٩]+)\s*={2,}\s*$/gm;

/**
 * تقسيم خرج النموذج إلى صفحات بحسب علامات «=== صفحة N ===».
 *
 * الصفحة المطلوبة التي لم تظهر لها علامة تعود نصًّا فارغًا — لا تُسقط:
 * إسقاطها يجعل القراءة تُعيدها في النداء التالي إلى ما لا نهاية.
 * وإن غابت العلامات كلها وكانت صفحة واحدة مطلوبة، فالنص كله لها.
 */
export function parseOcrTranscript(transcript: string, expectedPages: number[]): OcrPage[] {
  const found = new Map<number, string>();
  const markers: Array<{ page: number; start: number; end: number }> = [];

  for (const match of transcript.matchAll(PAGE_MARKER)) {
    markers.push({
      page: Number(toLatinDigits(match[1])),
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
    });
  }

  for (let i = 0; i < markers.length; i += 1) {
    const marker = markers[i];
    const sliceEnd = i + 1 < markers.length ? markers[i + 1].start : transcript.length;
    const body = transcript.slice(marker.end, sliceEnd).trim();
    found.set(marker.page, (found.get(marker.page) ?? '') + (found.has(marker.page) ? '\n' : '') + body);
  }

  if (markers.length === 0 && expectedPages.length === 1) {
    return [{ pageNumber: expectedPages[0], text: transcript.trim() }];
  }

  return expectedPages.map((pageNumber) => ({
    pageNumber,
    text: (found.get(pageNumber) ?? '').trim(),
  }));
}

/** عدد صفحات PDF — من pdf-lib لا pdf.js، لأنه ما سيقصّ الصفحات لاحقًا */
export async function countPdfPages(buffer: Buffer): Promise<number> {
  const source = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
  return source.getPageCount();
}

/** ملف PDF جديد يحمل الصفحات المطلوبة فقط (أرقامها من ١) */
export async function slicePdfPages(buffer: Buffer, pageNumbers: number[]): Promise<Buffer> {
  const source = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
  const target = await PDFDocument.create();
  const copied = await target.copyPages(
    source,
    pageNumbers.map((n) => n - 1),
  );
  for (const page of copied) target.addPage(page);
  return Buffer.from(await target.save({ useObjectStreams: false }));
}

function formatPageList(pages: number[]): string {
  return pages.join('، ');
}

async function transcribe(
  content: Anthropic.ContentBlockParam[],
  expectedPages: number[],
): Promise<OcrBatchResult> {
  const anthropic = getAnthropicClient();
  const model = serverEnv.anthropicModel;
  const startedAt = Date.now();

  const instruction =
    expectedPages.length === 1
      ? `هذه صفحة واحدة رقمها ${expectedPages[0]} في المستند الأصلي. انسخها.`
      : `هذا الملف يحتوي على ${expectedPages.length} صفحات من المستند الأصلي، أرقامها بالترتيب: ${formatPageList(expectedPages)}. انسخها كلها.`;

  let response: Anthropic.Message;
  try {
    // بثّ لا طلب واحد: النسخ الطويل قد يتجاوز مهلة الطلب غير المبثوث
    const stream = anthropic.messages.stream({
      model,
      max_tokens: OCR_MAX_OUTPUT_TOKENS,
      system: OCR_SYSTEM_PROMPT,
      ...(supportsEffort(model) ? { output_config: { effort: 'low' as const } } : {}),
      messages: [{ role: 'user', content: [...content, { type: 'text', text: instruction }] }],
    });
    response = await stream.finalMessage();
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      throw new AppError(
        'AI_UNAVAILABLE',
        'خدمة القراءة الضوئية مشغولة حاليًا. أعد المحاولة بعد دقيقة من قائمة الخيارات بجانب المستند.',
        error.message,
      );
    }
    throw new AppError(
      'DOCUMENT_PROCESSING',
      'تعذّرت القراءة الضوئية للمستند. أعد المحاولة، وإن تكرّر الخطأ تواصل مع الدعم.',
      error instanceof Error ? error.message : String(error),
    );
  }

  if (response.stop_reason === 'refusal') {
    throw new AppError(
      'DOCUMENT_PROCESSING',
      'تعذّرت قراءة هذا الملف ضوئيًا. تأكد أنه مستند عمل عادي ثم أعد المحاولة.',
      'ocr refusal',
    );
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  const truncated = response.stop_reason === 'max_tokens';
  if (truncated) {
    logger.warn('بلغت القراءة الضوئية سقف الرموز فبُترت', {
      model,
      pages: expectedPages.length,
      outputTokens: response.usage.output_tokens,
    });
  }

  return {
    pages: parseOcrTranscript(text, expectedPages),
    model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    costUsd: estimateCostUsd(model, response.usage.input_tokens, response.usage.output_tokens),
    latencyMs: Date.now() - startedAt,
    truncated,
  };
}

/** قراءة صفحات محددة من PDF ممسوح ضوئيًا */
export async function ocrPdfPages(buffer: Buffer, pageNumbers: number[]): Promise<OcrBatchResult> {
  let slice: Buffer;
  try {
    slice = await slicePdfPages(buffer, pageNumbers);
  } catch (error) {
    throw new AppError(
      'DOCUMENT_PROCESSING',
      'تعذّر تجهيز صفحات الملف للقراءة الضوئية. تأكد أن الملف سليم وغير محمي بكلمة مرور.',
      error instanceof Error ? error.message : String(error),
    );
  }

  return transcribe(
    [
      {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: slice.toString('base64') },
      },
    ],
    pageNumbers,
  );
}

/** قراءة صورة واحدة — تُعامل صفحةً رقمها ١ */
export async function ocrImage(buffer: Buffer, mediaType: OcrImageMimeType): Promise<OcrBatchResult> {
  return transcribe(
    [{ type: 'image', source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') } }],
    [1],
  );
}
