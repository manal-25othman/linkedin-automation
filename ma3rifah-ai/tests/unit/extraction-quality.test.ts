import { describe, expect, it } from 'vitest';
import { assessExtraction } from '@/lib/rag/extract';

/**
 * كفاية الاستخراج.
 *
 * كانت العتبة عشرين محرفًا **مطلقة**. ومستندٌ من ستّ وأربعين صفحة
 * ممسوحة ضوئيًّا يحمل ترويسةً واحدة يتجاوزها، فيُفهرَس ويُعلَن «جاهز»
 * وفيه مقطع واحد — ثم يقول المساعد «لم أجد» عن معلومة يراها صاحبه.
 *
 * والقياس صار نسبيًّا: محارف لكل صفحة، ونسبة صفحات تحمل نصًّا.
 *
 * والضابط السالب هنا أهمّ من الموجب: مستندٌ من صفحة أو صفحتين قد
 * يكون قصيرًا بحقّ، ولو رُفض لصار الحارس عطلًا جديدًا.
 */

const page = (n: number, text: string) => ({ pageNumber: n, text });
const make = (text: string, pageCount: number | null, pages: { pageNumber: number; text: string }[]) =>
  ({ text, pages, pageCount });

describe('يُقبَل ما هو سليم', () => {
  it('مستند من صفحة واحدة قصير — لا يُحكم عليه بمتوسط', () => {
    // هذه حالة المستخدمة بعينها: ملفٌ من صفحة، ومقطعٌ واحد، وهو صحيح
    const result = assessExtraction(
      make('تعديلات نظام العمل: عُدّلت المادة الرابعة والسبعون.', 1, [
        page(1, 'تعديلات نظام العمل: عُدّلت المادة الرابعة والسبعون.'),
      ]),
    );
    expect(result.verdict).toBe('OK');
  });

  it('صفحتان قصيرتان تمرّان', () => {
    const text = 'قرار إداري رقم ٤٤. يسري من تاريخه.';
    expect(assessExtraction(make(text, 2, [page(1, text)])).verdict).toBe('OK');
  });

  it('مستند طويل كثيف يمرّ', () => {
    const body = 'مادة نظامية مكتوبة بنصّ كامل. '.repeat(40);
    const pages = Array.from({ length: 10 }, (_, i) => page(i + 1, body));
    expect(assessExtraction(make(body.repeat(10), 10, pages)).verdict).toBe('OK');
  });

  it('ملف بلا ترقيم صفحات (docx) لا يخضع للقياس النسبيّ', () => {
    const text = 'محتوى ملف وورد قصير لكنه سليم تمامًا ولا صفحات له.';
    expect(assessExtraction(make(text, null, [])).verdict).toBe('OK');
  });
});

describe('يُرَدّ ما هو معطوب', () => {
  it('الفارغ تمامًا', () => {
    const result = assessExtraction(make('', 12, []));
    expect(result.verdict).toBe('EMPTY');
    expect(result.message).toContain('OCR');
  });

  it('ستّ وأربعون صفحة بترويسة واحدة — الحالة التي كانت تمرّ', () => {
    const header = 'المملكة العربية السعودية — وزارة الموارد البشرية';
    const result = assessExtraction(make(header, 46, [page(1, header)]));

    expect(result.verdict).toBe('SPARSE');
    expect(result.charsPerPage).toBeLessThan(5);
    // الرسالة تحمل الأرقام كي يعرف صاحبها لماذا رُدّ
    expect(result.message).toContain('46');
    expect(result.message).toContain('OCR');
  });

  it('نصفُ الصفحات بلا نصّ — مسحٌ جزئيّ', () => {
    const body = 'نصّ حقيقي كثيف في هذه الصفحة. '.repeat(20);
    const pages = Array.from({ length: 4 }, (_, i) => page(i + 1, body));
    // عشر صفحات، أربعٌ منها فقط فيها نصّ
    const result = assessExtraction(make(body.repeat(4), 10, pages));
    expect(result.verdict).toBe('SPARSE');
    expect(result.message).toContain('4');
  });
});

describe('التقرير يحمل ما يُشخَّص به', () => {
  it('يذكر العدّ والصفحات والكثافة', () => {
    const body = 'كلام. '.repeat(30);
    const pages = Array.from({ length: 5 }, (_, i) => page(i + 1, body));
    const result = assessExtraction(make(body.repeat(5), 5, pages));

    expect(result.charCount).toBeGreaterThan(0);
    expect(result.pageCount).toBe(5);
    expect(result.pagesWithText).toBe(5);
    expect(result.charsPerPage).toBeGreaterThan(0);
  });
});
