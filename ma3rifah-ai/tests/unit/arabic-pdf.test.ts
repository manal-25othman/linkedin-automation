import { describe, expect, it } from 'vitest';
import { fixArabicGlyphCluster } from '@/lib/rag/extract';

/**
 * حارس انحدار لاستخراج العربية من PDF.
 *
 * تفكّ pdf.js رسم لام-ألف وعلامات التشكيل إلى عنصر واحد بحرفين
 * معكوسين. بلا تصحيح تُخزَّن «خلافات» بصيغة «خالفات»، فلا يشبه متجهها
 * متجه السؤال المكتوب صحيحًا، فيفشل الاسترجاع ويقول المساعد «لم أجد
 * معلومات» عن نص موجود في المستند. الاختبار يقارن بنقاط الترميز لا
 * بالشكل، لأن عرض العربية في الطرفية مضلّل.
 */
describe('fixArabicGlyphCluster', () => {
  it('يصحّح ترتيب رباط لام-ألف بأشكال الألف الأربعة', () => {
    expect(fixArabicGlyphCluster('ال')).toBe('لا'); // ال ← لا
    expect(fixArabicGlyphCluster('أل')).toBe('لأ'); // أل ← لأ
    expect(fixArabicGlyphCluster('إل')).toBe('لإ'); // إل ← لإ
    expect(fixArabicGlyphCluster('آل')).toBe('لآ'); // آل ← لآ
  });

  it('يعيد علامة التشكيل بعد حرفها لا قبله', () => {
    expect(fixArabicGlyphCluster('ًا')).toBe('اً'); // ًا ← اً
    expect(fixArabicGlyphCluster('ُك')).toBe('كُ'); // ُك ← كُ
    expect(fixArabicGlyphCluster('ًال')).toBe('لاً');
  });

  it('لا يمسّ الكلمات الكاملة — قلبها كان سيفسدها', () => {
    for (const word of ['المادة', 'الوزارة', 'التسوية', 'خلافات', 'لائحة']) {
      expect(fixArabicGlyphCluster(word)).toBe(word);
    }
  });

  it('لا يمسّ الحروف المفردة ولا النص اللاتيني', () => {
    expect(fixArabicGlyphCluster('ا')).toBe('ا');
    expect(fixArabicGlyphCluster('ل')).toBe('ل');
    expect(fixArabicGlyphCluster('www.hrsd.gov.sa')).toBe('www.hrsd.gov.sa');
    expect(fixArabicGlyphCluster('ــ')).toBe('ــ'); // تطويل
  });
});
