import { beforeAll, describe, expect, it } from 'vitest';
import { extractDocumentText } from '@/lib/rag/extract';

/**
 * حارس انحدار لتحميل عامل pdf.js في بيئة مبنيّة.
 *
 * على Node تُعطّل pdf.js العامل وتحمّل منطقه بـ
 * ‎import("./pdf.worker.mjs")‎ موسومًا بـ webpackIgnore. لا يتتبّع أي
 * مُجمِّع مسارًا كهذا، فلا يُنسخ ملف العامل إلى حزمة النشر ويفشل كل
 * استخراج بـ«Setting up fake worker failed». محليًا ينجح لأن
 * node_modules كاملة على القرص، فلا يكشف الاختبار العادي العطل.
 *
 * لذلك يحاكي هذا الاختبار الظرف: يوجّه workerSrc إلى مسار غير موجود.
 * فإن نجح الاستخراج فذلك لأن الكود سجّل العامل مسبقًا في
 * globalThis.pdfjsWorker ولم يلمس ذلك الاستيراد أصلًا. وإن حُذف
 * التسجيل يومًا، سقط هذا الاختبار بدل أن يسقط الإنتاج.
 */

/** أصغر ملف PDF صالح — يُبنى هنا فلا نُودع بيانات أحد في المستودع */
function buildMinimalPdf(): Buffer {
  const stream = 'BT /F1 12 Tf 20 150 Td (Settlement parties regulation test document) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R ' +
      '/Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}

describe('استخراج PDF بلا ملف عامل على مساره الافتراضي', () => {
  beforeAll(async () => {
    // يُحمَّل هنا لتُضبط الخيارات على النسخة نفسها التي يستعملها المستخرِج
    const { ensurePdfRuntimeGlobals } = await import('@/lib/rag/pdf-runtime');
    ensurePdfRuntimeGlobals();

    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = '/nonexistent/pdf.worker.mjs';
  });

  it('ينجح لأن العامل مسجَّل مسبقًا لا محمَّل من مسار', async () => {
    const result = await extractDocumentText(buildMinimalPdf(), 'doc.pdf', 'application/pdf');

    expect(result.pageCount).toBe(1);
    expect(result.text).toContain('Settlement parties regulation');
  });

  it('يسجّل العامل في globalThis كي تتجاوز pdf.js استيرادها الديناميكي', () => {
    expect((globalThis as unknown as Record<string, unknown>).pdfjsWorker).toBeDefined();
  });
});
