import { describe, expect, it } from 'vitest';
import {
  AppError,
  needsReference,
  newErrorReference,
  sanitizeTechnicalDetail,
  toAppError,
} from '../../src/lib/errors';

/**
 * رقم مرجع الخطأ.
 *
 * المقصود منه واحد: أن يستطيع المستخدم أن يقول «حدث خطأ رقمه ERR-8F31»،
 * فيجده المطوّر في السجلّ ومعه السبب الحقيقي. وبدونه يصف المستخدم ما
 * رآه بكلماته، ويبحث المطوّر في آلاف السطور عن خطأ لا يعرف وقته.
 *
 * وأهم ما يُختبر هنا **أين لا يظهر**: رقمٌ على «أدخل بريدًا صحيحًا»
 * يُشعِر المستخدم بأن خطأه المطبعيّ عطلٌ في المنصة، ويُغرِق الدعم
 * بأرقام لا شيء خلفها.
 */

describe('متى يُعطى رقم مرجع', () => {
  it('يُعطى لما لا يصلحه المستخدم بنفسه', () => {
    expect(needsReference('INTERNAL')).toBe(true);
    expect(needsReference('DOCUMENT_PROCESSING')).toBe(true);
    expect(needsReference('AI_UNAVAILABLE')).toBe(true);
    expect(needsReference('EMBEDDINGS_UNAVAILABLE')).toBe(true);
  });

  it('لا يُعطى لما يصلحه المستخدم', () => {
    expect(needsReference('VALIDATION')).toBe(false);
    expect(needsReference('FORBIDDEN')).toBe(false);
    expect(needsReference('NOT_FOUND')).toBe(false);
    expect(needsReference('UNAUTHENTICATED')).toBe(false);
    expect(needsReference('RATE_LIMITED')).toBe(false);
    expect(needsReference('FILE_TOO_LARGE')).toBe(false);
    expect(needsReference('UNSUPPORTED_FILE')).toBe(false);
    expect(needsReference('QUOTA_EXCEEDED')).toBe(false);
  });
});

describe('شكل الرقم', () => {
  it('قصير وقابل للقراءة في الهاتف', () => {
    expect(newErrorReference()).toMatch(/^ERR-[0-9A-F]{4}$/);
  });

  it('يتغيّر بين خطأ وآخر', () => {
    const seen = new Set(Array.from({ length: 200 }, () => newErrorReference()));
    // 200 عيّنة من 65536 احتمالًا: التكرار وارد، والتنوّع هو المطلوب
    expect(seen.size).toBeGreaterThan(150);
  });

  it('لا يحمل معلومة عن الخطأ ولا عن صاحبه', () => {
    // من التقط الرقم من شاشة لا يستفيد منه شيئًا
    const reference = newErrorReference();
    expect(reference).not.toMatch(/\d{10,}/); // لا طابع زمني
    expect(reference).toHaveLength(8);
  });
});

describe('الرسالة المعروضة', () => {
  it('تحمل الرقم للأخطاء الداخلية', () => {
    const error = new AppError('INTERNAL');
    expect(error.reference).toMatch(/^ERR-/);
    expect(error.displayMessage).toContain('رقم المرجع');
    expect(error.displayMessage).toContain(error.reference!);
  });

  it('لا تحمله لأخطاء المستخدم', () => {
    const error = new AppError('VALIDATION', 'أدخل بريدًا إلكترونيًا صحيحًا.');
    expect(error.reference).toBeUndefined();
    expect(error.displayMessage).toBe('أدخل بريدًا إلكترونيًا صحيحًا.');
    expect(error.displayMessage).not.toContain('ERR-');
  });

  it('تبقى الرسالة الأصلية كاملة قبل الرقم', () => {
    const error = new AppError('AI_UNAVAILABLE');
    expect(error.displayMessage.startsWith(error.message)).toBe(true);
  });
});

describe('تغليف الأخطاء غير المتوقعة', () => {
  it('الخطأ الخام يصير داخليًا برقم مرجع', () => {
    const wrapped = toAppError(new Error('connection refused at 10.0.0.1:5432'));
    expect(wrapped.code).toBe('INTERNAL');
    expect(wrapped.reference).toMatch(/^ERR-/);
  });

  it('لا تسرّب لتفاصيل تقنية في الرسالة المعروضة', () => {
    // هذا هو الشرط الذي يجعل عرض الخطأ آمنًا أصلًا
    const wrapped = toAppError(new Error('connection refused at 10.0.0.1:5432'));
    expect(wrapped.displayMessage).not.toContain('10.0.0.1');
    expect(wrapped.displayMessage).not.toContain('connection refused');
    expect(wrapped.detail).toContain('connection refused');
  });

  it('AppError قائم يمرّ كما هو بمرجعه', () => {
    const original = new AppError('DOCUMENT_PROCESSING');
    const wrapped = toAppError(original);
    expect(wrapped).toBe(original);
    expect(wrapped.reference).toBe(original.reference);
  });

  it('الاستجابة المُسلسَلة تحمل المرجع ولا تحمل التفصيل', () => {
    const json = toAppError(new Error('secret internal detail')).toJSON();
    expect(json.error).toHaveProperty('reference');
    expect(JSON.stringify(json)).not.toContain('secret internal detail');
  });
});

describe('تنقيح التفصيل التقني', () => {
  it('يمحو الروابط ومسارات النظام ويُبقي اسم الملف', () => {
    const cleaned = sanitizeTechnicalDetail(
      'Error: cannot find /var/task/node_modules/pdfjs/pdf.worker.mjs',
    );
    expect(cleaned).toContain('pdf.worker.mjs');
    expect(cleaned).not.toContain('/var/task');
  });

  it('يأخذ السطر الأول فقط — لا أثر مكدّس', () => {
    const cleaned = sanitizeTechnicalDetail('TypeError: boom\n    at foo (bar.js:1:1)');
    expect(cleaned).not.toContain('at foo');
  });
});
