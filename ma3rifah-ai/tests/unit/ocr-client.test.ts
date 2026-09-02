import { beforeEach, describe, expect, it, vi } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { PDFDocument } from 'pdf-lib';

/**
 * تركيب نداء القراءة الضوئية — بعميل مزيَّف.
 *
 * لا مفتاح للمزوّد في بيئة الاختبار، فما يُختبر هنا هو ما نملكه: شكل
 * الطلب (وثيقة PDF مقصوصة بترميز base64 + تعليمة بأرقام الصفحات)،
 * وتفسير الرد (بتر، رفض، ازدحام)، والتكلفة المسجَّلة.
 */

const streamMock = vi.fn();

vi.mock('@/lib/ai/claude', () => ({
  getAnthropicClient: () => ({ messages: { stream: streamMock } }),
  supportsEffort: () => true,
  estimateCostUsd: (_m: string, i: number, o: number) => (i * 3 + o * 15) / 1_000_000,
}));

vi.mock('@/lib/env', () => ({
  serverEnv: { anthropicModel: 'claude-sonnet-5', ocrMaxPagesPerDocument: 60 },
}));

const { ocrImage, ocrPdfPages } = await import('@/lib/rag/ocr');

function reply(text: string, stopReason: string, usage = { input_tokens: 1200, output_tokens: 300 }) {
  return {
    finalMessage: async () => ({
      content: [{ type: 'text', text }],
      stop_reason: stopReason,
      usage,
    }),
  };
}

async function threePagePdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.addPage();
  doc.addPage();
  doc.addPage();
  return Buffer.from(await doc.save());
}

beforeEach(() => streamMock.mockReset());

describe('شكل الطلب', () => {
  it('يرسل الصفحات المقصوصة وثيقةً base64 مع أرقامها الأصلية في التعليمة', async () => {
    streamMock.mockReturnValue(reply('=== صفحة 2 ===\nثانية\n=== صفحة 3 ===\nثالثة', 'end_turn'));

    const result = await ocrPdfPages(await threePagePdf(), [2, 3]);

    expect(streamMock).toHaveBeenCalledTimes(1);
    const request = streamMock.mock.calls[0][0];
    expect(request.model).toBe('claude-sonnet-5');
    expect(request.output_config).toEqual({ effort: 'low' });
    expect(request.max_tokens).toBeGreaterThanOrEqual(4000);

    const [doc, text] = request.messages[0].content;
    expect(doc.type).toBe('document');
    expect(doc.source.media_type).toBe('application/pdf');
    // المقصوص صفحتان لا ثلاث: base64 لملف PDF صالح يبدأ بـ %PDF
    const sliced = await PDFDocument.load(Buffer.from(doc.source.data, 'base64'));
    expect(sliced.getPageCount()).toBe(2);
    expect(text.text).toContain('2، 3');

    expect(result.pages).toEqual([
      { pageNumber: 2, text: 'ثانية' },
      { pageNumber: 3, text: 'ثالثة' },
    ]);
    expect(result.truncated).toBe(false);
    expect(result.costUsd).toBeCloseTo((1200 * 3 + 300 * 15) / 1_000_000, 9);
  });

  it('الصورة تُرسل كتلة image بنوعها، وتُعدّ صفحة رقم ١', async () => {
    streamMock.mockReturnValue(reply('قرار إداري رقم ٥', 'end_turn'));
    const result = await ocrImage(Buffer.from('fake'), 'image/jpeg');
    const [img] = streamMock.mock.calls[0][0].messages[0].content;
    expect(img).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg' } });
    expect(result.pages).toEqual([{ pageNumber: 1, text: 'قرار إداري رقم ٥' }]);
  });
});

describe('تفسير الرد', () => {
  it('بلوغ السقف يُعلَّم بترًا لا نجاحًا صامتًا', async () => {
    streamMock.mockReturnValue(reply('=== صفحة 1 ===\nنص طويل مبتو', 'max_tokens'));
    const result = await ocrPdfPages(await threePagePdf(), [1]);
    expect(result.truncated).toBe(true);
    expect(result.pages[0].text).toBe('نص طويل مبتو');
  });

  it('الرفض خطأٌ صريح لا نصّ فارغ يدخل قاعدة المعرفة', async () => {
    streamMock.mockReturnValue(reply('', 'refusal'));
    await expect(ocrPdfPages(await threePagePdf(), [1])).rejects.toMatchObject({
      code: 'DOCUMENT_PROCESSING',
    });
  });

  it('ازدحام المزوّد يعود AI_UNAVAILABLE برسالة «أعد المحاولة»', async () => {
    // كما يقع فعلًا: البثّ يُنشأ، والخطأ يأتي من finalMessage() مرفوضًا
    const rateLimited = new Anthropic.RateLimitError(429, { error: { message: 'rate' } }, 'rate', new Headers());
    streamMock.mockReturnValue({ finalMessage: () => Promise.reject(rateLimited) });
    await expect(ocrPdfPages(await threePagePdf(), [1])).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
    });
  });
});
