import 'server-only';

/**
 * كائنات DOM التي تفترض pdf.js وجودها.
 *
 * تشترك pdf.js في ملف واحد بين المتصفح والخادم، فتشير إلى DOMMatrix
 * وPath2D وImageData حتى في المسارات التي لا ترسم شيئًا. بيئة Node
 * لا توفّرها، فيفشل استخراج النص بـ«DOMMatrix is not defined» — خطأ
 * لا علاقة له بسلامة الملف، وقد ظهر على الخادم دون بيئة الاختبار.
 *
 * استخراج النص لا يرسم، لكن DOMMatrix مُنفَّذة هنا تنفيذًا صحيحًا لا
 * صوريًا: بديل فارغ يمرّ بصمت ثم يفسد إحداثيات المقاطع، ومنها تُستنتج
 * المسافات بين الكلمات. الخطأ الصامت أسوأ من الخطأ الظاهر.
 */

/** مصفوفة تحويل ثنائية الأبعاد: [a c e ; b d f ; 0 0 1] */
class Matrix2D {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;

  constructor(init?: number[] | string) {
    if (Array.isArray(init) && init.length >= 6) {
      [this.a, this.b, this.c, this.d, this.e, this.f] = init;
    }
  }

  get is2D(): boolean {
    return true;
  }

  get isIdentity(): boolean {
    return (
      this.a === 1 && this.b === 0 && this.c === 0 &&
      this.d === 1 && this.e === 0 && this.f === 0
    );
  }

  multiplySelf(other: Matrix2D): Matrix2D {
    const { a, b, c, d, e, f } = this;
    this.a = a * other.a + c * other.b;
    this.b = b * other.a + d * other.b;
    this.c = a * other.c + c * other.d;
    this.d = b * other.c + d * other.d;
    this.e = a * other.e + c * other.f + e;
    this.f = b * other.e + d * other.f + f;
    return this;
  }

  multiply(other: Matrix2D): Matrix2D {
    return new Matrix2D([this.a, this.b, this.c, this.d, this.e, this.f]).multiplySelf(other);
  }

  translateSelf(x = 0, y = 0): Matrix2D {
    this.e += this.a * x + this.c * y;
    this.f += this.b * x + this.d * y;
    return this;
  }

  scaleSelf(x = 1, y = x): Matrix2D {
    this.a *= x;
    this.b *= x;
    this.c *= y;
    this.d *= y;
    return this;
  }

  invertSelf(): Matrix2D {
    const determinant = this.a * this.d - this.b * this.c;

    if (determinant === 0) {
      this.a = this.b = this.c = this.d = this.e = this.f = Number.NaN;
      return this;
    }

    const { a, b, c, d, e, f } = this;
    this.a = d / determinant;
    this.b = -b / determinant;
    this.c = -c / determinant;
    this.d = a / determinant;
    this.e = (c * f - d * e) / determinant;
    this.f = (b * e - a * f) / determinant;
    return this;
  }

  toString(): string {
    return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`;
  }
}

/** مسار رسم — يُشار إليه ولا يُرسم عند استخراج النص */
class PathStub {
  addPath(): void {}
  closePath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  bezierCurveTo(): void {}
  quadraticCurveTo(): void {}
  arc(): void {}
  arcTo(): void {}
  ellipse(): void {}
  rect(): void {}
}

class ImageDataStub {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(Math.max(0, width * height * 4));
  }
}

/**
 * تُستدعى قبل تحميل pdf.js — التعريف بعد تحميلها لا ينفع، إذ تُقيَّم
 * بعض المراجع وقت تقييم الوحدة.
 */
export function ensurePdfRuntimeGlobals(): void {
  const scope = globalThis as unknown as Record<string, unknown>;

  scope.DOMMatrix ??= Matrix2D;
  scope.Path2D ??= PathStub;
  scope.ImageData ??= ImageDataStub;
}
