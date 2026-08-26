import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * التحوّل الصامت إلى المزوّد المحلّي.
 *
 * كان غياب `VOYAGE_API_KEY` يُسجَّل تحذيرًا ثم يمضي إلى `LocalProvider`
 * — دالّة تجزئة لا نموذج.
 *
 * والضرر ليس رداءة النتائج بل **اختلاط الفهرس**: مستندٌ فُهرس بلا
 * مفتاح تُخزَّن متجهاته في فضاءٍ لا صلة له بفضاء Voyage. فإن أُضيف
 * المفتاح بعده صار السؤال في فضاءٍ والمخزون في آخر، والتشابه ضجيج.
 *
 * ولا يظهر خطأ في أي مرحلة: الرفع ينجح، والحالة «جاهز»، والجواب «لم
 * أجد معلومات كافية». فيُتَّهم النموذج، والعلّة مفتاحٌ ناقص وقع قبل
 * ذلك بأيام. ولا يُصلحه إضافة المفتاح — يلزم إعادة فهرسة كل ما دخل.
 */

const SOURCE = readFileSync(join(process.cwd(), 'src/lib/rag/embeddings.ts'), 'utf8');

afterEach(() => vi.restoreAllMocks());

describe('لا تحوّل صامت', () => {
  it('غياب المفتاح لا يُعالَج بتحذير يمضي بعده', () => {
    // الصيغة القديمة: logger.warn ثم السقوط إلى المحلّي
    expect(SOURCE).not.toMatch(/logger\.warn\([^)]*التحوّل إلى المزوّد المحلي/);
  });

  it('يُرفض صراحةً برميِ خطأ', () => {
    expect(SOURCE).toContain('function refuseSilentFallback');
    expect(SOURCE).toMatch(/refuseSilentFallback\('voyage', 'VOYAGE_API_KEY'\)/);
    expect(SOURCE).toMatch(/refuseSilentFallback\('openai', 'OPENAI_API_KEY'\)/);
  });

  it('الرفض من نوعٍ لا يعود — `never`', () => {
    // لو أعادت الدالّة لسقط التنفيذ إلى `new LocalProvider` بعدها
    expect(SOURCE).toMatch(/function refuseSilentFallback\([^)]*\): never/);
  });

  it('الرسالة تقول ما يُفعَل لا ما وقع فقط', () => {
    expect(SOURCE).toContain('EMBEDDINGS_PROVIDER=local');
    expect(SOURCE).toMatch(/أضِف \$\{envVar\}/);
  });

  it('المحلّي يبقى متاحًا لمن يطلبه صراحةً', () => {
    // منعُه كليًّا يكسر التطوير والاختبار بلا مفتاح
    expect(SOURCE).toContain('cachedProvider = new LocalProvider(dimensions);');
  });

  it('المحلّي ما زال موسومًا أنه ليس إنتاجيًّا', () => {
    const local = SOURCE.slice(SOURCE.indexOf('class LocalProvider'));
    expect(local).toMatch(/isProduction = false/);
  });
});
