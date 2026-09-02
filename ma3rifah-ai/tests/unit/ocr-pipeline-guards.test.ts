import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { detectFileKind, extractOrDetectScan } from '@/lib/rag/extract';

/**
 * حرّاس مسار القراءة الضوئية.
 *
 * ثلاثة أخطار: قراءة تُحاسَب قبل أن تُفحص الحصة، ونصّ صفحات مقروءة
 * يصير مقروءًا لمستخدمي الشركة (أو غيرها) مباشرةً من الجدول، ومستندٌ
 * نصّي يُساق إلى القراءة الضوئية فيدفع ثمن ما كان مجانًا.
 */

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
const INGEST = read('src/lib/rag/ingest.ts');
const MIGRATION = read('supabase/migrations/0036_ocr.sql');
const ACTIONS = read('src/app/(dashboard)/documents/actions.ts');
const ENV_EXAMPLE = read('.env.example');
const MUTATION = read('tests/sql/90_mutation.sql');
const RUNNER = read('tests/sql/run-isolation-tests.sh');

describe('التمييز: ما يُقرأ ضوئيًا وما لا', () => {
  it('PDF بلا نصّ يُميَّز «ممسوحًا» بدل أن يُرفض', async () => {
    const doc = await PDFDocument.create();
    for (let i = 0; i < 4; i += 1) doc.addPage();
    const outcome = await extractOrDetectScan(Buffer.from(await doc.save()), 'scan.pdf', 'application/pdf');
    expect(outcome.kind).toBe('scanned');
    if (outcome.kind === 'scanned') expect(outcome.pageCount).toBe(4);
  });

  it('الصورة تُميَّز بنوعها', async () => {
    const outcome = await extractOrDetectScan(Buffer.from('not-really-an-image'), 'قرار.jpg', 'image/jpeg');
    expect(outcome).toEqual({ kind: 'image', mediaType: 'image/jpeg' });
  });

  it('نوع الصورة يُستنتج من الامتداد إن جاء النوع فارغًا', async () => {
    const outcome = await extractOrDetectScan(Buffer.from('x'), 'تعميم.PNG', '');
    expect(outcome).toEqual({ kind: 'image', mediaType: 'image/png' });
  });

  it('النصّ العادي يبقى نصًّا — لا قراءة ضوئية تُدفع لما هو مجاني', async () => {
    const text = 'مادة نظامية مكتوبة بنصّ كامل. '.repeat(20);
    const outcome = await extractOrDetectScan(Buffer.from(text, 'utf8'), 'policy.txt', 'text/plain');
    expect(outcome.kind).toBe('text');
  });

  it('ملف نصّي فارغ يُرفض ولا يُساق إلى القراءة الضوئية', async () => {
    await expect(extractOrDetectScan(Buffer.from(''), 'empty.txt', 'text/plain')).rejects.toThrow();
  });

  it('امتدادات الصور معروفة', () => {
    for (const name of ['a.png', 'b.jpg', 'c.jpeg', 'd.webp']) expect(detectFileKind(name)).toBe('image');
    expect(detectFileKind('e.gif')).toBeNull();
  });
});

describe('الحصة قبل التكلفة', () => {
  it('check_ocr_quota يُستدعى قبل أي نداء قراءة', () => {
    const quotaAt = INGEST.indexOf("rpc('check_ocr_quota'");
    const firstCall = Math.min(INGEST.indexOf('await ocrImage('), INGEST.indexOf('await ocrPdfPages('));
    expect(quotaAt).toBeGreaterThan(0);
    expect(quotaAt).toBeLessThan(firstCall);
  });

  it('الحصة تُفحص على الصفحات المتبقية لا الكلية — الاستئناف لا يُحاسَب مرتين', () => {
    expect(INGEST).toContain('p_pages: remaining.length');
  });

  it('كل دفعة تُسجَّل استهلاكًا بعدد صفحاتها', () => {
    expect(INGEST).toContain("operation: 'ocr'");
    expect(INGEST).toContain('ocrPages: result.pages.length');
  });

  it('سقف الملف الواحد يُقرأ من البيئة وموثَّق في المثال', () => {
    expect(INGEST).toContain('serverEnv.ocrMaxPagesPerDocument');
    expect(ENV_EXAMPLE).toMatch(/^OCR_MAX_PAGES_PER_DOCUMENT=60$/m);
  });
});

describe('عزل نصوص الصفحات المقروءة', () => {
  it('الجدول محمي بـ RLS بلا أي سياسة — لا يقرؤه مستخدم مباشرة', () => {
    expect(MIGRATION).toContain('alter table public.document_ocr_pages enable row level security');
    expect(MIGRATION).toContain('revoke all on public.document_ocr_pages from public, anon, authenticated');
    expect(MIGRATION).not.toMatch(/create policy \w+ on public\.document_ocr_pages/);
  });

  it('فحص الحصة وتسجيل الاستهلاك لمفتاح الخدمة وحده', () => {
    expect(MIGRATION).toContain(
      'revoke all on function public.check_ocr_quota(uuid, int) from public, anon, authenticated',
    );
    expect(MIGRATION).toContain('grant execute on function public.check_ocr_quota(uuid, int) to service_role');
    expect(MIGRATION).toContain(
      'grant execute on function public.record_usage(uuid, int, bigint, bigint, numeric, int) to service_role',
    );
  });

  it('المفتاح الجديد في القائمة البيضاء لمحلّل الحدود', () => {
    expect(MIGRATION).toMatch(/'max_questions_monthly',\s*'max_ocr_pages_monthly'/);
  });

  it('المتابعة من المتصفح لا تُقبل إلا لمستند الشركة وهو قيد المعالجة', () => {
    const fn = ACTIONS.slice(ACTIONS.indexOf('export async function continueProcessingAction'));
    expect(fn).toContain("requirePermission('documents.manage')");
    expect(fn).toContain('document.company_id !== company.id');
    expect(fn).toContain("document.status !== 'PROCESSING'");
  });

  it('اختبارات SQL مسجَّلة في المشغّل، والشاهد السلبي يفتح الجدول عمدًا', () => {
    expect(RUNNER).toContain('09_ocr_tests.sql');
    expect(MUTATION).toContain('document_ocr_pages');
  });
});
