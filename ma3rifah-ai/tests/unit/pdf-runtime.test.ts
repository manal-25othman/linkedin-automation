import { afterEach, describe, expect, it } from 'vitest';
import { ensurePdfRuntimeGlobals } from '@/lib/rag/pdf-runtime';

/**
 * حارس انحدار لبيئة تشغيل pdf.js على الخادم.
 *
 * تعتمد pdf.js على حزمة اختيارية (@napi-rs/canvas) لتوفير DOMMatrix، ثم
 * تُنشئ مصفوفة على مستوى الوحدة بلا شرط. الحزمة مثبّتة محليًا وغير
 * مثبّتة على Vercel، فنجح الاستخراج في التطوير وفشل في الإنتاج بـ
 * «DOMMatrix is not defined» — عطل لا تكشفه بيئة الاختبار وحدها.
 *
 * ولأن حساب المسافات بين الكلمات يقرأ إحداثيات المقاطع، فبديل صوري
 * يمرّ بصمت ثم يفسد النص العربي. لذلك تُفحص صحّة الحساب لا وجوده فقط.
 */

type MatrixLike = {
  a: number; b: number; c: number; d: number; e: number; f: number;
  multiplySelf(other: MatrixLike): MatrixLike;
  translateSelf(x?: number, y?: number): MatrixLike;
  scaleSelf(x?: number, y?: number): MatrixLike;
  invertSelf(): MatrixLike;
  isIdentity: boolean;
  is2D: boolean;
};

type MatrixConstructor = new (init?: number[]) => MatrixLike;

const scope = globalThis as unknown as Record<string, unknown>;

function tuple(matrix: MatrixLike): number[] {
  return [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f];
}

function withCleanScope<T>(run: () => T): T {
  const saved = {
    DOMMatrix: scope.DOMMatrix,
    Path2D: scope.Path2D,
    ImageData: scope.ImageData,
  };
  delete scope.DOMMatrix;
  delete scope.Path2D;
  delete scope.ImageData;

  try {
    return run();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete scope[key];
      else scope[key] = value;
    }
  }
}

afterEach(() => {
  delete scope.DOMMatrix;
  delete scope.Path2D;
  delete scope.ImageData;
});

describe('ensurePdfRuntimeGlobals', () => {
  it('يعرّف الكائنات التي تفترض pdf.js وجودها', () => {
    withCleanScope(() => {
      expect(scope.DOMMatrix).toBeUndefined();

      ensurePdfRuntimeGlobals();

      expect(typeof scope.DOMMatrix).toBe('function');
      expect(typeof scope.Path2D).toBe('function');
      expect(typeof scope.ImageData).toBe('function');
    });
  });

  it('لا يستبدل تنفيذًا موجودًا — المتصفح والبيئات المزوّدة أولى', () => {
    withCleanScope(() => {
      const existing = class Sentinel {};
      scope.DOMMatrix = existing;

      ensurePdfRuntimeGlobals();

      expect(scope.DOMMatrix).toBe(existing);
    });
  });

  it('يمكن استدعاؤه مرارًا بلا أثر جانبي', () => {
    withCleanScope(() => {
      ensurePdfRuntimeGlobals();
      const first = scope.DOMMatrix;
      ensurePdfRuntimeGlobals();

      expect(scope.DOMMatrix).toBe(first);
    });
  });
});

describe('DOMMatrix البديلة تحسب لا تتظاهر', () => {
  function Matrix(init?: number[]): MatrixLike {
    ensurePdfRuntimeGlobals();
    const Constructor = scope.DOMMatrix as MatrixConstructor;
    return new Constructor(init);
  }

  it('تبدأ مصفوفة وحدة ثنائية الأبعاد', () => {
    const matrix = Matrix();
    expect(tuple(matrix)).toEqual([1, 0, 0, 1, 0, 0]);
    expect(matrix.isIdentity).toBe(true);
    expect(matrix.is2D).toBe(true);
  });

  it('تنقل النقطة بالإزاحة المطلوبة', () => {
    // ترتيب pdf.js: [a b c d e f] ⇒ x' = a·x + c·y + e
    const matrix = Matrix([2, 0, 0, 3, 10, 20]).translateSelf(5, 7);
    expect(tuple(matrix)).toEqual([2, 0, 0, 3, 20, 41]);
  });

  it('تضاعف بالقياس على كل محور', () => {
    expect(tuple(Matrix([2, 0, 0, 3, 10, 20]).scaleSelf(2, 4))).toEqual([
      4, 0, 0, 12, 10, 20,
    ]);
  });

  it('الضرب في مصفوفة الوحدة لا يغيّر شيئًا', () => {
    const original = [2, 1, -1, 3, 10, 20];
    expect(tuple(Matrix(original).multiplySelf(Matrix()))).toEqual(original);
  });

  it('الضرب في المعكوس يعيد الوحدة — الحساب صحيح لا صوري', () => {
    const matrix = Matrix([2, 1, -1, 3, 10, 20]);
    const inverse = Matrix([2, 1, -1, 3, 10, 20]).invertSelf();

    for (const [index, value] of tuple(matrix.multiplySelf(inverse)).entries()) {
      expect(value).toBeCloseTo([1, 0, 0, 1, 0, 0][index], 10);
    }
  });

  it('المصفوفة المنفردة تُعطي NaN لا صفرًا صامتًا', () => {
    // محدّد صفري: لا معكوس. الصفر هنا كان سيبدو إحداثيًا مشروعًا.
    expect(tuple(Matrix([1, 2, 2, 4, 0, 0]).invertSelf()).every(Number.isNaN)).toBe(true);
  });
});
