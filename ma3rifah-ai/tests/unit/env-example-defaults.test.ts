import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `.env.example` كان يخالف ما اختارته الشيفرة.
 *
 * حُسِب الهامش فتبيّن أنه **سالب** على النموذج والجهد والسقف القديمة:
 * كل خطة تخسر عند الاستهلاك الكامل، أي أن العميل الأكثر استعمالًا هو
 * الأكثر خسارةً للمنصّة. فغُيّرت الافتراضات في `src/lib/env.ts` إلى
 * `claude-sonnet-5` و`low` و`3000`.
 *
 * وبقي `.env.example` على القديم: `claude-opus-5` و`medium` و`8000`.
 *
 * وهو الملف الذي يُنسخ منه إلى Vercel. فمن اتّبعه — ونحن اتّبعناه —
 * ضبط الإنتاج على التركيبة الخاسرة، والافتراض الآمن في الشيفرة لا
 * يُطبَّق أصلًا لأن المتغيّر **موجود** ويحمل القيمة القديمة.
 *
 * ولا يظهر هذا في أي اختبار ولا في أي سجلّ: النظام يعمل، والإجابات
 * صحيحة، والفاتورة وحدها تعرف.
 *
 * فهذا الحارس يربط الملفين: من غيّر افتراضًا في الشيفرة ونسي المثال،
 * يسقط عنده الاختبار.
 */

const ENV_EXAMPLE = readFileSync(join(process.cwd(), '.env.example'), 'utf8');
const ENV_SOURCE = readFileSync(join(process.cwd(), 'src/lib/env.ts'), 'utf8');

/** يقرأ `KEY=value` من `.env.example` — أول تطابق غير معلَّق. */
function fromExample(key: string): string | null {
  const match = ENV_EXAMPLE.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
}

/** يقرأ الافتراض من `optional('KEY', 'x')` أو `optionalInt('KEY', 123)`. */
function fromCode(key: string): string | null {
  const match = ENV_SOURCE.match(
    new RegExp(`optional(?:Int)?\\(\\s*'${key}'\\s*,\\s*'?([^',)]+)'?\\s*\\)`),
  );
  return match ? match[1].trim() : null;
}

describe('المثال يطابق افتراضات الشيفرة', () => {
  // الثلاثة التي تمسّ التكلفة مباشرةً. وغيرها (المفاتيح والروابط) لا
  // افتراض له أصلًا، فلا معنى لمقارنته.
  const COST_KEYS = [
    'ANTHROPIC_MODEL',
    'ANTHROPIC_EFFORT',
    'ANTHROPIC_MAX_OUTPUT_TOKENS',
  ];

  for (const key of COST_KEYS) {
    it(`${key}: قيمة المثال هي افتراض الشيفرة`, () => {
      const example = fromExample(key);
      const code = fromCode(key);

      expect(code, `لم يُقرأ افتراض ${key} من src/lib/env.ts`).not.toBeNull();
      expect(example, `${key} غائب عن .env.example`).not.toBeNull();
      expect(example).toBe(code);
    });
  }

  it('المثال لا يقترح opus — ورفعه قرارُ هامشٍ لا قرارُ إعداد', () => {
    expect(fromExample('ANTHROPIC_MODEL')).not.toContain('opus');
  });

  it('سقف الخرج في المثال لا يتجاوز ٤٠٠٠ رمز', () => {
    const cap = Number(fromExample('ANTHROPIC_MAX_OUTPUT_TOKENS'));
    expect(Number.isFinite(cap)).toBe(true);
    expect(cap).toBeLessThanOrEqual(4000);
  });
});
