import { describe, expect, it } from 'vitest';
import { diffLines, diffStats } from '@/lib/diff';

describe('diffLines', () => {
  it('يعدّ النصّين المتطابقين بلا فروق', () => {
    const text = 'سطر أول\nسطر ثانٍ';
    const lines = diffLines(text, text);
    expect(lines.every((line) => line.kind === 'same')).toBe(true);
  });

  it('يُظهر الإضافة بلا اعتبار بقية الأسطر مختلفة', () => {
    const before = 'أ\nب\nج';
    const after = 'أ\nجديد\nب\nج';

    const stats = diffStats(diffLines(before, after));

    expect(stats.added).toBe(1);
    expect(stats.removed).toBe(0);
    // المهم: إدراج سطر واحد لا يجعل ما بعده «مختلفًا»
    expect(stats.unchanged).toBe(3);
  });

  it('يُظهر الحذف والاستبدال', () => {
    const stats = diffStats(diffLines('أ\nب\nج', 'أ\nمعدّل\nج'));
    expect(stats.added).toBe(1);
    expect(stats.removed).toBe(1);
    expect(stats.unchanged).toBe(2);
  });

  it('يتجاهل فروق المسافات وحدها', () => {
    const stats = diffStats(diffLines('- خبرة   في   البرمجة', '-   خبرة في البرمجة'));
    expect(stats.added).toBe(0);
    expect(stats.removed).toBe(0);
  });

  it('يتعامل مع النصّ الفارغ', () => {
    expect(diffStats(diffLines('', 'سطر')).added).toBe(1);
    expect(diffStats(diffLines('سطر', '')).removed).toBe(1);
  });
});
