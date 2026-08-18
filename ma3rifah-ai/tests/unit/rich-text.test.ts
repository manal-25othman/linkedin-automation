import { describe, expect, it } from 'vitest';
import {
  isSafeHref,
  parseInline,
  parseRichText,
  firstParagraphText,
} from '../../src/lib/content/rich-text';

/**
 * محلِّل نصّ الصفحات المصنوعة.
 *
 * وأهم ما يُختبر هنا ليس التنسيق بل ما **لا** يُنسَّق: النصّ يُكتب في
 * اللوحة ويُعرض على كل زائر، فقبولُ رابطٍ بمخطّط برمجيّ يجعل حقل تحرير
 * بابَ حقن. ولذلك يبدأ الملف بالروابط المرفوضة لا بالمقبولة.
 */

describe('الروابط المقبولة', () => {
  it('يقبل المسار الداخلي والمرساة', () => {
    expect(isSafeHref('/pricing')).toBe(true);
    expect(isSafeHref('#section')).toBe(true);
  });

  it('يقبل https والبريد', () => {
    expect(isSafeHref('https://example.com')).toBe(true);
    expect(isSafeHref('mailto:hello@example.com')).toBe(true);
  });

  it('يرفض المخطّطات البرمجية', () => {
    expect(isSafeHref('javascript:alert(1)')).toBe(false);
    expect(isSafeHref('JavaScript:alert(1)')).toBe(false);
    expect(isSafeHref('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeHref('vbscript:msgbox(1)')).toBe(false);
  });

  it('يرفض http الصريح والبروتوكول الموروث', () => {
    // الموروث `//host` يصير http على صفحة http — فيسقط التشفير صامتًا
    expect(isSafeHref('http://example.com')).toBe(false);
    expect(isSafeHref('//example.com')).toBe(false);
  });

  it('يرفض الفارغ', () => {
    expect(isSafeHref('')).toBe(false);
    expect(isSafeHref('   ')).toBe(false);
  });
});

describe('التحليل داخل السطر', () => {
  it('يفصل التعريض عن النصّ', () => {
    expect(parseInline('قبل **وسط** بعد')).toEqual([
      { kind: 'text', text: 'قبل ' },
      { kind: 'bold', text: 'وسط' },
      { kind: 'text', text: ' بعد' },
    ]);
  });

  it('يحوّل الرابط المقبول إلى رابط', () => {
    expect(parseInline('انظر [الأسعار](/pricing)')).toEqual([
      { kind: 'text', text: 'انظر ' },
      { kind: 'link', text: 'الأسعار', href: '/pricing' },
    ]);
  });

  it('الرابط المرفوض يبقى نصًّا ولا يختفي', () => {
    // إسقاط النصّ يخفي عن الكاتبة أن شيئًا لم يعمل
    expect(parseInline('[اضغط](javascript:alert)')).toEqual([
      { kind: 'text', text: 'اضغط' },
    ]);
  });

  it('لا يرى وسوم HTML تنسيقًا', () => {
    const spans = parseInline('<script>alert(1)</script>');
    expect(spans).toEqual([{ kind: 'text', text: '<script>alert(1)</script>' }]);
  });
});

describe('تحليل الكتل', () => {
  it('يفصل الفقرات بالسطر الفارغ ويصل أسطر الفقرة الواحدة', () => {
    const blocks = parseRichText('سطر أول\nتتمّته\n\nفقرة ثانية');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({
      kind: 'paragraph',
      spans: [{ kind: 'text', text: 'سطر أول تتمّته' }],
    });
  });

  it('يقرأ العناوين بمستوييها', () => {
    const blocks = parseRichText('## كبير\n### أصغر');
    expect(blocks.map((block) => block.kind === 'heading' && block.level)).toEqual([2, 3]);
  });

  it('يجمع النقاط في قائمة واحدة', () => {
    const blocks = parseRichText('- أول\n- ثانٍ\n- ثالث');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind === 'list' && blocks[0].items).toHaveLength(3);
    expect(blocks[0].kind === 'list' && blocks[0].ordered).toBe(false);
  });

  it('يفصل القائمة المرقّمة عن النقطية ولا يخلطهما', () => {
    const blocks = parseRichText('- نقطة\n1. رقم');
    expect(blocks).toHaveLength(2);
    expect(blocks.map((block) => block.kind === 'list' && block.ordered)).toEqual([
      false,
      true,
    ]);
  });

  it('العنوان يُنهي الفقرة قبله', () => {
    const blocks = parseRichText('فقرة\n## عنوان');
    expect(blocks.map((block) => block.kind)).toEqual(['paragraph', 'heading']);
  });

  it('نصّ فارغ يعطي لا شيء لا كتلة فارغة', () => {
    expect(parseRichText('')).toEqual([]);
    expect(parseRichText('\n\n   \n')).toEqual([]);
  });

  it('يقرأ نهايات أسطر ويندوز', () => {
    expect(parseRichText('أول\r\n\r\nثانٍ')).toHaveLength(2);
  });
});

describe('الوصف المشتق', () => {
  it('يأخذ أول فقرة بلا رموز التنسيق', () => {
    expect(firstParagraphText('## عنوان\n\nنصّ **عريض** هنا')).toBe('نصّ عريض هنا');
  });

  it('يقصّ الطويل ويضع نقاطًا', () => {
    const long = 'ا'.repeat(300);
    const result = firstParagraphText(long, 20);
    expect(result).toHaveLength(20);
    expect(result.endsWith('…')).toBe(true);
  });

  it('يعيد فراغًا حين لا فقرة', () => {
    expect(firstParagraphText('## عنوان وحده')).toBe('');
  });
});
