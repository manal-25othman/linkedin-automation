import { describe, it, expect, beforeAll } from 'vitest';
import { embedTexts, getEmbeddingProvider, resetEmbeddingProvider, toPgVector } from '@/lib/rag/embeddings';
import { checkRateLimit, resetRateLimits } from '@/lib/rate-limit';

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let index = 0; index < a.length; index += 1) dot += a[index] * b[index];
  return dot; // المتجهات مُطبَّعة مسبقًا
}

describe('مزوّد التضمينات', () => {
  beforeAll(() => {
    process.env.EMBEDDINGS_PROVIDER = 'local';
    process.env.EMBEDDINGS_DIMENSIONS = '1024';
    resetEmbeddingProvider();
  });

  it('يعلن بوضوح أن المزوّد المحلي غير صالح للإنتاج', () => {
    const provider = getEmbeddingProvider();
    expect(provider.name).toBe('local');
    expect(provider.isProduction).toBe(false);
  });

  it('ينتج متجهًا بالأبعاد المضبوطة', async () => {
    const [vector] = await embedTexts(['سياسة الإجازات السنوية']);
    expect(vector).toHaveLength(1024);
  });

  it('ينتج متجهات مُطبَّعة (طولها واحد)', async () => {
    const [vector] = await embedTexts(['رصيد الإجازة السنوية 21 يوم عمل']);
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it('حتمي: النص نفسه ينتج المتجه نفسه', async () => {
    const [first] = await embedTexts(['سياسة العمل عن بعد']);
    const [second] = await embedTexts(['سياسة العمل عن بعد']);
    expect(first).toEqual(second);
  });

  it('يعطي النصوص المتقاربة تشابهًا أعلى من المتباعدة', async () => {
    const [leaveQuestion, leaveDocument, purchaseDocument] = await embedTexts([
      'كم عدد أيام الإجازة السنوية؟',
      'رصيد الإجازة السنوية 21 يوم عمل ويرتفع إلى 30 يومًا بعد خمس سنوات',
      'حدود الاعتماد المالي للمشتريات تبدأ من ثلاثة آلاف ريال',
    ]);

    const relevant = cosineSimilarity(leaveQuestion, leaveDocument);
    const irrelevant = cosineSimilarity(leaveQuestion, purchaseDocument);

    expect(relevant).toBeGreaterThan(irrelevant);
  });

  it('يوحّد الهمزات فيتطابق «الإجازات» مع «الاجازات»', async () => {
    const [withHamza, withoutHamza, unrelated] = await embedTexts([
      'سياسة الإجازات',
      'سياسة الاجازات',
      'إجراءات المشتريات',
    ]);

    expect(cosineSimilarity(withHamza, withoutHamza)).toBeGreaterThan(
      cosineSimilarity(withHamza, unrelated),
    );
  });

  it('يعيد مصفوفة فارغة لمدخل فارغ', async () => {
    expect(await embedTexts([])).toEqual([]);
  });

  it('يحوّل المتجه إلى صيغة pgvector النصية', () => {
    expect(toPgVector([0.1, -0.2, 0.3])).toBe('[0.1,-0.2,0.3]');
  });
});

describe('تحديد معدل الطلبات', () => {
  it('يسمح ضمن الحد ويمنع بعد تجاوزه', () => {
    resetRateLimits();
    const rule = { limit: 3, windowMs: 60_000 };

    expect(checkRateLimit('user-a', rule).allowed).toBe(true);
    expect(checkRateLimit('user-a', rule).allowed).toBe(true);
    expect(checkRateLimit('user-a', rule).allowed).toBe(true);

    const blocked = checkRateLimit('user-a', rule);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('يعزل المستخدمين عن بعضهم', () => {
    resetRateLimits();
    const rule = { limit: 1, windowMs: 60_000 };

    expect(checkRateLimit('user-a', rule).allowed).toBe(true);
    expect(checkRateLimit('user-a', rule).allowed).toBe(false);
    // مستخدم آخر لا يتأثر بتجاوز الأول
    expect(checkRateLimit('user-b', rule).allowed).toBe(true);
  });
});
