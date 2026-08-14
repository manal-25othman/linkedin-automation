import { describe, expect, it } from 'vitest';
import { selectContextChunks } from '@/lib/rag/retrieval';
import type { RetrievedChunk } from '@/lib/rag/retrieval';

/**
 * اختبارات معادلات اختيار السياق.
 *
 * ما يراه النموذج يحدّد ما يهلوس به. مقطع ضعيف الصلة يمرّ إلى السياق
 * يُغري النموذج بحشو الإجابة منه، فتظهر الهلوسة وكأنها من عند النموذج
 * وهي في الحقيقة من عندنا — أطعمناه ما لا يخصّ السؤال.
 */

function chunk(id: string, similarity: number, content: string): RetrievedChunk {
  return {
    chunkId: id,
    documentId: `doc-${id}`,
    documentName: `مستند ${id}`,
    content,
    pageNumber: 1,
    sectionTitle: null,
    similarity,
  };
}

describe('selectContextChunks — العتبة النسبية', () => {
  it('يُسقط المقاطع البعيدة عن أفضل مقطع', () => {
    const selected = selectContextChunks(
      [
        chunk('a', 0.88, 'تُقدَّم طلبات تسوية الخلافات إلى الإدارة المختصة.'),
        chunk('b', 0.84, 'تختص الإدارة بخلافات العمالة المنزلية ومن في حكمهم.'),
        // 0.42 ÷ 0.88 = 0.48 < 0.75 ⇒ تُسقط رغم تجاوزها العتبة المطلقة
        chunk('c', 0.42, 'تُحفظ سجلات الموارد البشرية في الأرشيف المركزي.'),
      ],
      6,
    );

    expect(selected.map((item) => item.chunkId)).toEqual(['a', 'b']);
  });

  it('يُبقي كل المقاطع حين تتقارب درجاتها', () => {
    const selected = selectContextChunks(
      [
        chunk('a', 0.80, 'المادة الأولى تعريفات الخلاف العمالي.'),
        chunk('b', 0.78, 'المادة الثانية اختصاص إدارة التسوية.'),
        chunk('c', 0.76, 'المادة الثالثة مواعيد تقديم الطلب.'),
      ],
      6,
    );

    expect(selected).toHaveLength(3);
  });

  it('لا يُسقط شيئًا حين لا مرشّحين', () => {
    expect(selectContextChunks([], 6)).toEqual([]);
  });
});

describe('selectContextChunks — التنويع (MMR)', () => {
  it('يُسقط النسخة شبه المكرّرة ويُبقي المقطع المكمّل', () => {
    const text = 'تُقدَّم طلبات تسوية الخلافات إلى الإدارة المختصة خلال خمسة عشر يومًا.';

    const selected = selectContextChunks(
      [
        chunk('a', 0.90, text),
        chunk('b', 0.89, text), // نسخة حرفية — لا تضيف معلومة
        chunk('c', 0.80, 'الرسم المقرر على طلب التسوية سبعمائة وخمسون ريالًا.'),
      ],
      6,
    );

    const ids = selected.map((item) => item.chunkId);
    expect(ids).toContain('a');
    expect(ids).toContain('c');
    expect(ids).not.toContain('b');
  });

  it('يحترم سقف عدد المقاطع', () => {
    const topics = [
      'تعريف الخلاف العمالي وأطرافه وشروط قبوله',
      'اختصاص إدارة التسوية ونطاق ولايتها الجغرافي',
      'مواعيد تقديم الطلب والمهل النظامية للرد',
      'رسوم الطلب وحالات الإعفاء منها',
      'إجراءات الجلسة وحضور الوكيل النظامي',
      'التبليغ بالوسائل الإلكترونية وأثره',
      'الاعتراض أمام المحكمة العمالية المختصة',
      'تنفيذ القرار والجهة المنوط بها',
      'حفظ الملفات والسجلات وسريتها',
      'أحكام ختامية ونفاذ اللائحة ونشرها',
    ];

    const candidates = topics.map((text, index) =>
      chunk(`c${index}`, 0.9 - index * 0.005, text),
    );

    expect(selectContextChunks(candidates, 3)).toHaveLength(3);
  });

  it('لا يخلط التشابه الأسلوبي بالتكرار — مواد مختلفة تبقى كلها', () => {
    // نصوص نظامية تتشارك القالب («تختص الإدارة بـ…») وتختلف في المضمون.
    // خلط القالب بالتكرار يحذف مادة مكمّلة، فتنقص الإجابة من حيث لا يظهر
    // نقص — وهذا أخطر من تمرير مقطع زائد.
    const selected = selectContextChunks(
      [
        chunk('a', 0.88, 'تختص الإدارة بالنظر في طلبات تسوية خلافات الأجور والبدلات.'),
        chunk('b', 0.86, 'تختص الإدارة بالنظر في طلبات إنهاء العقد والتعويض عنه.'),
        chunk('c', 0.85, 'تختص الإدارة بالنظر في طلبات تذاكر السفر والإجازات السنوية.'),
      ],
      6,
    );

    expect(selected).toHaveLength(3);
  });

  it('يُعيد المختارَ مرتّبًا تنازليًا بالتشابه', () => {
    const selected = selectContextChunks(
      [
        chunk('low', 0.76, 'نص ثالث مختلف في مفرداته عن سواه.'),
        chunk('high', 0.92, 'نص أول له مفردات خاصة به وحده.'),
        chunk('mid', 0.84, 'نص ثانٍ يتناول موضوعًا مغايرًا تمامًا.'),
      ],
      6,
    );

    const similarities = selected.map((item) => item.similarity);
    expect(similarities).toEqual([...similarities].sort((a, b) => b - a));
  });
});
