import { describe, expect, it } from 'vitest';
import { supportsEffort } from '@/lib/ai/claude';

/**
 * حارس انحدار: إرسال output_config.effort إلى نموذج لا يدعمه يُرجع 400
 * فيسقط الطلب كاملًا ويظهر للمستخدم «الخدمة غير متاحة» بلا سبب واضح.
 * هذا ما حدث فعلًا مع haiku في مساعد الزوّار.
 */
describe('supportsEffort', () => {
  it('يقبل نماذج opus وsonnet وfable التي تدعم المعامل', () => {
    for (const model of [
      'claude-opus-5',
      'claude-opus-4-8',
      'claude-sonnet-5',
      'claude-sonnet-4-6',
      'claude-fable-5',
    ]) {
      expect(supportsEffort(model)).toBe(true);
    }
  });

  it('يرفض haiku — لا يدعم المعامل ويردّ بخطأ 400', () => {
    expect(supportsEffort('claude-haiku-4-5')).toBe(false);
    expect(supportsEffort('claude-haiku-4-5-20251001')).toBe(false);
  });

  it('يقبل المعرّفات المؤرّخة للنماذج المدعومة', () => {
    expect(supportsEffort('claude-opus-4-5-20251101')).toBe(true);
  });

  it('يرفض أي نموذج غير معروف بدل افتراض الدعم', () => {
    expect(supportsEffort('some-future-model')).toBe(false);
  });
});
