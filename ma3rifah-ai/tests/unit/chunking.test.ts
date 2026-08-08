import { describe, it, expect } from 'vitest';
import { buildChunks, estimateTokens, CHUNK_CONFIG } from '@/lib/rag/chunk';
import { cleanText, detectFileKind } from '@/lib/rag/extract';

describe('تنظيف النص', () => {
  it('يزيل محارف التحكم في اتجاه النص التي تفسد مستندات PDF العربية', () => {
    const raw = 'سياسة‏الإجازات‎ السنوية';
    expect(cleanText(raw)).toBe('سياسةالإجازات السنوية');
  });

  it('يوحّد المسافات وفواصل الأسطر المفرطة', () => {
    expect(cleanText('سطر\r\n\r\n\r\n\r\nآخر')).toBe('سطر\n\nآخر');
    expect(cleanText('كلمة    أخرى')).toBe('كلمة أخرى');
  });

  it('يزيل المسافة غير القابلة للكسر', () => {
    expect(cleanText('أ ب')).toBe('أ ب');
  });
});

describe('تحديد نوع الملف', () => {
  it('يعتمد على نوع MIME عند توفّره', () => {
    expect(detectFileKind('x', 'application/pdf')).toBe('pdf');
    expect(
      detectFileKind(
        'x',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).toBe('docx');
  });

  it('يرجع إلى الامتداد عند غياب نوع MIME', () => {
    expect(detectFileKind('policy.pdf')).toBe('pdf');
    expect(detectFileKind('sheet.xlsx')).toBe('xlsx');
    expect(detectFileKind('notes.md')).toBe('txt');
  });

  it('يرفض الأنواع غير المدعومة', () => {
    expect(detectFileKind('malware.exe')).toBeNull();
    expect(detectFileKind('archive.zip')).toBeNull();
    expect(detectFileKind('noextension')).toBeNull();
  });
});

describe('تقدير الرموز', () => {
  it('يعطي النص العربي نسبة رموز أعلى من الإنجليزي لنفس الطول', () => {
    const arabic = 'سياسة الإجازات السنوية في الشركة تمنح الموظف واحدًا وعشرين يومًا';
    const english = 'The annual leave policy grants the employee twenty one days off';

    const arabicRatio = estimateTokens(arabic) / arabic.length;
    const englishRatio = estimateTokens(english) / english.length;

    expect(arabicRatio).toBeGreaterThan(englishRatio);
  });

  it('لا يعيد صفرًا لنص غير فارغ', () => {
    expect(estimateTokens('أ')).toBeGreaterThan(0);
  });
});

describe('تقطيع المستندات', () => {
  const longParagraph = (marker: string) =>
    `${marker} ${'سياسة الإجازات السنوية تمنح الموظف رصيدًا محددًا من الأيام. '.repeat(12)}`;

  it('يقسّم النص الطويل إلى عدة مقاطع', () => {
    const chunks = buildChunks({
      text: [longParagraph('أ'), longParagraph('ب'), longParagraph('ج')].join('\n\n'),
      pages: [],
      pageCount: null,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.content.length > 0)).toBe(true);
  });

  it('يعطي كل مقطع فهرسًا متسلسلًا فريدًا', () => {
    const chunks = buildChunks({
      text: [longParagraph('أ'), longParagraph('ب'), longParagraph('ج')].join('\n\n'),
      pages: [],
      pageCount: null,
    });

    const indexes = chunks.map((chunk) => chunk.index);
    expect(new Set(indexes).size).toBe(indexes.length);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });

  it('يحفظ رقم الصفحة لكل مقطع حتى يمكن الاستشهاد به', () => {
    const chunks = buildChunks({
      text: '',
      pages: [
        { pageNumber: 1, text: longParagraph('الصفحة الأولى') },
        { pageNumber: 7, text: longParagraph('الصفحة السابعة') },
      ],
      pageCount: 7,
    });

    const pages = new Set(chunks.map((chunk) => chunk.pageNumber));
    expect(pages.has(1)).toBe(true);
    expect(pages.has(7)).toBe(true);
  });

  it('لا يتجاوز أي مقطع الحد الأقصى بفارق كبير', () => {
    const chunks = buildChunks({
      text: Array.from({ length: 8 }, (_, index) => longParagraph(`ف${index}`)).join('\n\n'),
      pages: [],
      pageCount: null,
    });

    for (const chunk of chunks) {
      // التداخل قد يزيد الطول قليلًا فوق الحد المستهدف
      expect(chunk.content.length).toBeLessThan(CHUNK_CONFIG.maxChars * 2);
    }
  });

  it('يلتقط العناوين ويربطها بالمقاطع التابعة لها', () => {
    const chunks = buildChunks({
      text: `## سياسة الإجازة المرضية\n\n${longParagraph('محتوى')}`,
      pages: [],
      pageCount: null,
    });

    expect(chunks[0].sectionTitle).toBe('سياسة الإجازة المرضية');
  });

  it('يعيد مقطعًا واحدًا على الأقل لنص قصير', () => {
    const chunks = buildChunks({
      text: 'رصيد الإجازة السنوية 21 يوم عمل.',
      pages: [],
      pageCount: null,
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain('21');
  });
});
