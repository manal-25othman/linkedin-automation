import { describe, expect, it } from 'vitest';
import {
  OCR_PAGES_PER_CALL,
  OCR_SYSTEM_PROMPT,
  countPdfPages,
  parseOcrTranscript,
  slicePdfPages,
} from '@/lib/rag/ocr';
import { PDFDocument } from 'pdf-lib';

/**
 * تقسيم خرج القراءة الضوئية إلى صفحات.
 *
 * النموذج يكتب الصفحات متتابعة بعلامة «=== صفحة N ===». والخطأ المكلف
 * هنا ليس علامة ناقصة بل صفحة تُسقَط: الصفحة المطلوبة التي لا تعود
 * تُطلب في النداء التالي، ثم التالي، فتدور القراءة إلى ما لا نهاية
 * وتُحاسَب الشركة على كل دورة.
 */

describe('parseOcrTranscript', () => {
  it('يفصل الصفحات بعلاماتها ويحفظ ترتيب الطلب', () => {
    const transcript = '=== صفحة 4 ===\nنص الرابعة\n=== صفحة 5 ===\nنص الخامسة';
    expect(parseOcrTranscript(transcript, [4, 5])).toEqual([
      { pageNumber: 4, text: 'نص الرابعة' },
      { pageNumber: 5, text: 'نص الخامسة' },
    ]);
  });

  it('الأرقام العربية-الهندية في العلامة تُقبل', () => {
    const transcript = '=== صفحة ٧ ===\nسابعة\n=== صفحة ٨ ===\nثامنة';
    expect(parseOcrTranscript(transcript, [7, 8]).map((p) => p.text)).toEqual(['سابعة', 'ثامنة']);
  });

  it('الصفحة المطلوبة بلا علامة تعود فارغة لا مُسقَطة — وإلا دارت القراءة أبدًا', () => {
    const pages = parseOcrTranscript('=== صفحة 1 ===\nأولى فقط', [1, 2]);
    expect(pages).toHaveLength(2);
    expect(pages[1]).toEqual({ pageNumber: 2, text: '' });
  });

  it('صفحة واحدة بلا أي علامة: النص كله لها', () => {
    expect(parseOcrTranscript('  تعميم رقم ١٢ بشأن الدوام  ', [9])).toEqual([
      { pageNumber: 9, text: 'تعميم رقم ١٢ بشأن الدوام' },
    ]);
  });

  it('علامة مكرّرة للصفحة نفسها تُدمج لا تُستبدل', () => {
    const transcript = '=== صفحة 2 ===\nجزء أ\n=== صفحة 2 ===\nجزء ب';
    expect(parseOcrTranscript(transcript, [2])[0].text).toBe('جزء أ\nجزء ب');
  });

  it('علامة لصفحة لم تُطلب تُتجاهل', () => {
    const transcript = '=== صفحة 1 ===\nأولى\n=== صفحة 99 ===\nدخيلة';
    const pages = parseOcrTranscript(transcript, [1]);
    expect(pages).toEqual([{ pageNumber: 1, text: 'أولى' }]);
  });
});

describe('ضوابط التكلفة والدقة', () => {
  it('الدفعة صغيرة — صفحتان لا أكثر، لسقف الخرج ولعمر الطلب', () => {
    expect(OCR_PAGES_PER_CALL).toBeLessThanOrEqual(2);
  });

  it('الموجّه نسخٌ حرفي: يمنع التلخيص والتصحيح والترجمة والتعليق', () => {
    for (const rule of ['تلخيص', 'تُصحّح', 'تُترجم', 'لا مقدمة', '[غير مقروء]', '=== صفحة N ===']) {
      expect(OCR_SYSTEM_PROMPT).toContain(rule);
    }
  });
});

describe('قصّ الصفحات بـ pdf-lib', () => {
  async function makePdf(pageCount: number): Promise<Buffer> {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pageCount; i += 1) doc.addPage([200, 200 + i]);
    return Buffer.from(await doc.save());
  }

  it('يعدّ الصفحات', async () => {
    expect(await countPdfPages(await makePdf(5))).toBe(5);
  });

  it('يقصّ الصفحات المطلوبة بترتيبها', async () => {
    const buffer = await makePdf(5);
    const slice = await slicePdfPages(buffer, [2, 4]);
    const parsed = await PDFDocument.load(slice);
    expect(parsed.getPageCount()).toBe(2);
    // ارتفاع كل صفحة يحمل رقمها الأصلي (200 + i): الثانية 201 والرابعة 203
    expect(parsed.getPage(0).getHeight()).toBe(201);
    expect(parsed.getPage(1).getHeight()).toBe(203);
  });
});
