import { describe, expect, it } from 'vitest';
import {
  normalizeArabic,
  contentTokens,
  extractNumbers,
  verifyNumbers,
  jaccard,
  containment,
  groundedness,
  parseCitations,
  stripCitationMarkers,
  verifyAnswer,
  CONFIDENCE_WEIGHTS,
} from '@/lib/rag/verify';

/**
 * اختبارات طبقة التحقق المضادة للهلوسة.
 *
 * الحالات مبنية على نص نظامي عربي حقيقي الأسلوب، لأن العطل الذي تكشفه
 * هذه الطبقة عربي المنشأ: تباين رسم الألف والتاء المربوطة يجعل الجملة
 * الراسخة تبدو مخترَعة، فيتحوّل التحذير إلى ضجيج يُعتاد تجاهله.
 */

describe('normalizeArabic', () => {
  it('يوحّد أشكال الألف والياء والتاء المربوطة', () => {
    expect(normalizeArabic('الإجازة')).toBe(normalizeArabic('الاجازه'));
    expect(normalizeArabic('أحمد')).toBe(normalizeArabic('احمد'));
    expect(normalizeArabic('علىٰ')).toBe(normalizeArabic('علي'));
  });

  it('يحذف التشكيل والتطويل', () => {
    expect(normalizeArabic('المُوَظَّف')).toBe(normalizeArabic('الموظف'));
    expect(normalizeArabic('مـــوظف')).toBe(normalizeArabic('موظف'));
  });

  it('يحوّل الأرقام العربية والفارسية إلى لاتينية', () => {
    expect(normalizeArabic('٣٠ يومًا')).toContain('30');
    expect(normalizeArabic('۱۵')).toContain('15');
  });
});

describe('contentTokens', () => {
  it('يُسقط الكلمات الوظيفية', () => {
    const tokens = contentTokens('من التي في هذا الموظف على');
    expect(tokens.has('موظف')).toBe(true);
    expect(tokens.has('من')).toBe(false);
    expect(tokens.has('في')).toBe(false);
  });

  it('يوحّد السوابق فتلتقي صيغ الكلمة الواحدة', () => {
    const withPrefix = contentTokens('بالإجازة');
    const bare = contentTokens('إجازة');
    expect([...withPrefix][0]).toBe([...bare][0]);
  });
});

describe('extractNumbers', () => {
  it('يوحّد صيغ الرقم الواحد', () => {
    const numbers = extractNumbers('المدة ١٬٥٠٠ ريال و 1,500 ريال و 1500 ريال');
    expect(numbers).toEqual(new Set(['1500']));
  });

  it('يطابق ٣٠ مع 30.0', () => {
    expect(extractNumbers('٣٠')).toEqual(extractNumbers('30.0'));
  });
});

describe('verifyNumbers — أدقّ فحص في الطبقة', () => {
  const source = 'يجب إشعار الطرف الآخر خلال خمسة عشر يومًا، والرسم 750 ريالًا.';

  it('يكشف الرقم المخترَع', () => {
    const result = verifyNumbers('مدة الإشعار 30 يومًا.', source);
    expect(result.unverified).toEqual(['30']);
    expect(result.ratio).toBe(0);
  });

  it('يقبل الرقم الوارد في المصدر', () => {
    const result = verifyNumbers('الرسم 750 ريالًا.', source);
    expect(result.unverified).toEqual([]);
    expect(result.ratio).toBe(1);
  });

  it('يطابق عبر اختلاف صيغة الأرقام', () => {
    expect(verifyNumbers('الرسم ٧٥٠ ريالًا.', source).unverified).toEqual([]);
  });

  it('يتجاهل الأعداد الصغيرة — ترقيم قوائم لا معطيات', () => {
    const result = verifyNumbers('أولًا: 1. راجع 2. وقّع 3. أرسل', source);
    expect(result.unverified).toEqual([]);
  });

  it('نسبة التأكّد تساوي واحدًا حين لا أرقام', () => {
    expect(verifyNumbers('يجب إشعار الطرف الآخر.', source).ratio).toBe(1);
  });
});

describe('jaccard و containment', () => {
  it('جاكار يساوي واحدًا للمجموعتين المتطابقتين وصفرًا للمنفصلتين', () => {
    expect(jaccard(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(1);
    expect(jaccard(new Set(['a']), new Set(['b']))).toBe(0);
  });

  it('الاحتواء غير متماثل — وهذا مقصود', () => {
    const small = new Set(['a']);
    const large = new Set(['a', 'b', 'c']);
    expect(containment(small, large)).toBe(1);
    expect(containment(large, small)).toBeCloseTo(1 / 3);
  });
});

describe('groundedness', () => {
  const source =
    'تُقدَّم طلبات تسوية الخلافات إلى الإدارة المختصة خلال خمسة عشر يومًا من تاريخ نشوء الخلاف.';

  it('إجابة منقولة من المصدر ترسخ فيه', () => {
    const score = groundedness('تُقدَّم طلبات التسوية إلى الإدارة المختصة.', source);
    expect(score).toBeGreaterThan(0.8);
  });

  it('إجابة مخترَعة من معرفة عامة لا ترسخ', () => {
    const score = groundedness(
      'يحق للموظف الحصول على بدل سكن وتذاكر سفر سنوية لعائلته.',
      source,
    );
    expect(score).toBeLessThan(0.3);
  });

  it('اختلاف رسم الهمزة لا يخفض الدرجة', () => {
    // «الادارة» بلا همزة مقابل «الإدارة» بها — نفس الكلمة رسمًا مختلفًا
    expect(groundedness('تقدم الطلبات الى الادارة المختصة.', source)).toBeGreaterThan(0.7);
  });

  it('عبارة العجز الثابتة لا تُحسب ضد الإجابة', () => {
    expect(
      groundedness('لم أجد معلومات كافية في قاعدة معرفة الشركة للإجابة.', source),
    ).toBe(1);
  });
});

describe('parseCitations', () => {
  it('يلتقط الصيغ العربية واللاتينية والأرقام العربية', () => {
    expect(parseCitations('الجواب [مصدر 1] وتفصيله [المصدر ٣]', 5)).toEqual([0, 2]);
    expect(parseCitations('answer [Source 2]', 5)).toEqual([1]);
  });

  it('يُسقط رقم مصدر خارج النطاق — النموذج قد يخترعه', () => {
    expect(parseCitations('[مصدر 9]', 3)).toEqual([]);
  });

  it('لا يكرّر المصدر الواحد', () => {
    expect(parseCitations('[مصدر 1] ثم [مصدر 1]', 3)).toEqual([0]);
  });
});

describe('stripCitationMarkers', () => {
  it('يحذف العلامات ويترك نصًا نظيفًا', () => {
    const clean = stripCitationMarkers('مدة الإشعار خمسة عشر يومًا [مصدر 1].');
    expect(clean).toBe('مدة الإشعار خمسة عشر يومًا.');
  });
});

describe('verifyAnswer — المعادلة المركّبة', () => {
  const chunks = [
    {
      content:
        'تُقدَّم طلبات تسوية الخلافات إلى الإدارة المختصة خلال خمسة عشر يومًا. الرسم 750 ريالًا.',
      similarity: 0.82,
    },
    {
      content: 'تختص الإدارة بتسوية خلافات العمالة المنزلية ومن في حكمهم.',
      similarity: 0.61,
    },
  ];

  it('إجابة راسخة مستشهدة ⇒ ثقة عالية بلا تحذير', () => {
    const result = verifyAnswer({
      answer: 'تُقدَّم طلبات تسوية الخلافات إلى الإدارة المختصة، والرسم 750 ريالًا [مصدر 1].',
      chunks,
    });

    expect(result.level).toBe('HIGH');
    expect(result.warnings).toEqual([]);
    expect(result.citedIndexes).toEqual([0]);
    expect(result.citationsInferred).toBe(false);
  });

  it('رقم مخترَع ⇒ تحذير صريح يذكر الرقم', () => {
    const result = verifyAnswer({
      answer: 'الرسم 2500 ريال [مصدر 1].',
      chunks,
    });

    expect(result.numbers.unverified).toEqual(['2500']);
    expect(result.warnings.join(' ')).toContain('2500');
    expect(result.confidence).toBeLessThan(0.72);
  });

  it('إجابة من معرفة عامة ⇒ ثقة منخفضة وتحذير رسوخ', () => {
    const result = verifyAnswer({
      answer: 'يحق للعامل بدل سكن وتذاكر سفر سنوية ومكافأة نهاية خدمة تعادل أجر شهرين.',
      chunks,
    });

    expect(result.level).toBe('LOW');
    expect(result.warnings.some((w) => w.includes('لا يقابله نص صريح'))).toBe(true);
  });

  it('بلا استشهاد صريح ⇒ يُستنتج المصدر معجميًا ويُعلَم بذلك', () => {
    const result = verifyAnswer({
      answer: 'تُقدَّم طلبات تسوية الخلافات إلى الإدارة المختصة.',
      chunks,
    });

    expect(result.citationsInferred).toBe(true);
    expect(result.citedIndexes.length).toBeGreaterThan(0);
  });

  it('لا يُرجع مصادر لم تُستعمل — عرضها ادّعاء رسوخ لم يحدث', () => {
    const result = verifyAnswer({
      answer: 'تختص الإدارة بخلافات العمالة المنزلية [مصدر 2].',
      chunks,
    });

    expect(result.citedIndexes).toEqual([1]);
  });

  it('الأوزان تجمع إلى واحد فتبقى الدرجة داخل [0,1]', () => {
    const total =
      CONFIDENCE_WEIGHTS.similarity +
      CONFIDENCE_WEIGHTS.groundedness +
      CONFIDENCE_WEIGHTS.numbers;
    expect(total).toBeCloseTo(1);

    for (const answer of ['', 'نص عشوائي لا صلة له', chunks[0].content]) {
      const { confidence } = verifyAnswer({ answer, chunks });
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    }
  });

  it('بلا مقاطع مسترجعة لا يُطلق تحذيرًا لا معنى له', () => {
    const result = verifyAnswer({ answer: 'لم أجد معلومات كافية.', chunks: [] });
    expect(result.warnings).toEqual([]);
  });
});

/**
 * الأعداد المكتوبة بالحروف.
 *
 * كان هذا **عطبًا صامتًا** في الوظيفة الأساسية للطبقة: المستند النظامي
 * العربي يكتب العدد بالحروف، والقارئ الرقمي لا يراه. فكانت إجابةٌ
 * تخترع «تسعين يومًا» تنال `ratio = 1` وتمرّ نظيفة.
 *
 * والاختبار يلزم الحالات الثلاث معًا لأن إصلاح إحداها دون أختيها ممكن،
 * وقد وقع فعلًا: طيّ كرسي الهمزة في النصّ دون الجدول أصلح «ثلاثمائة»
 * وكسر «مئتان».
 */
describe('الأعداد بالحروف — الثغرة التي كانت تُمرِّر الهلوسة', () => {
  it('«30» في الجواب و«ثلاثين» في المصدر — رقم واحد لا تحذير', () => {
    const result = verifyNumbers('مدة الإشعار 30 يومًا.', 'يلتزم بالإشعار قبل ثلاثين يومًا.');
    expect(result.unverified).toEqual([]);
    expect(result.total).toBe(1);
  });

  it('«ثلاثون» في الجواب و«30» في المصدر — يُتحقَّق منه فعلًا', () => {
    const result = verifyNumbers('مدة الإشعار ثلاثون يومًا.', 'يلتزم بالإشعار قبل 30 يومًا.');
    expect(result.total, 'العدد بالحروف يجب أن يدخل الحساب').toBe(1);
    expect(result.unverified).toEqual([]);
  });

  it('رقم مخترَع بالحروف يُكشف — وهذا هو مقصد الطبقة كلها', () => {
    const result = verifyNumbers('الإجازة تسعون يومًا.', 'الإجازة واحد وعشرون يومًا.');
    expect(result.unverified).toEqual(['90']);
    expect(result.ratio).toBe(0);
  });

  it('العطف يُركَّب: «خمسة وعشرون» ⇒ ٢٥', () => {
    expect(extractNumbers('لدينا خمسة وعشرون موظفًا')).toContain('25');
  });

  it('المضاعِفات تُضرب: «ثلاثة آلاف» ⇒ ٣٠٠٠ و«مئتان وخمسون» ⇒ ٢٥٠', () => {
    const found = extractNumbers('ثلاثة آلاف ريال، ومئتان وخمسون ريالًا');
    expect(found).toContain('3000');
    expect(found).toContain('250');
  });

  it('رسم الهمزة لا يغيّر القيمة: «ثلاثمائة وستون» ⇒ ٣٦٠', () => {
    expect(extractNumbers('ثلاثمائة وستون يومًا')).toContain('360');
    expect(extractNumbers('ثلاثمئة وستون يومًا')).toContain('360');
  });

  it('العدد المكرَّر حرفًا ورقمًا يبقى قيمة واحدة', () => {
    // «ثلاثون (30) يومًا» صياغة نظامية شائعة، ولو عُدَّت رقمين لظهر
    // في المصدر عددٌ لا وجود له
    expect([...extractNumbers('مدتها ثلاثون (30) يومًا')]).toEqual(['30']);
  });

  it('نصّ بلا أعداد لا يُنتج شيئًا — لا يُخترع رقم من فراغ', () => {
    expect([...extractNumbers('تُقدَّم الطلبات عبر إدارة الموارد البشرية')]).toEqual([]);
  });

  it('الجملة تفصل السلسلة فلا يُدمج عددان متباعدان', () => {
    // «عشرون. ثلاثون» عددان لا «خمسون»
    const found = [...extractNumbers('المهلة عشرون يومًا. والإشعار ثلاثون يومًا')].sort();
    expect(found).toEqual(['20', '30']);
  });
});
