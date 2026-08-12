import { describe, expect, it } from 'vitest';
import { safeStorageObjectName } from '@/lib/storage/object-name';

/**
 * حارس انحدار لمفاتيح التخزين.
 *
 * يرفض Supabase أي مفتاح فيه حرف خارج مجموعة محدودة، ويتحقّق بـ ‎\w‎
 * بلا راية unicode — أي ‎[A-Za-z0-9_]‎ وحدها. فأي اسم ملف عربي يُفشل
 * الرفع كله بـ«Invalid key»، وهو ما جعل ملفًا باسم لاتيني ينجح وآخر
 * باسم عربي يفشل، والسبب الاسم لا الملف.
 *
 * القاعدة أدناه منقولة عن تحقّق Supabase نفسه، فالاختبار يقيس بمقياس
 * الخادم لا بمقياس نظنّه.
 */
const SUPABASE_KEY_RULE = /^(\w|\/|!|-|\.|\*|'|\(|\)| |&|\$|@|=|;|:|\+|,|\?)*$/;

function storageKey(fileName: string): string {
  return `11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/${safeStorageObjectName(fileName)}`;
}

describe('safeStorageObjectName', () => {
  it('يقبله Supabase مهما كان اسم الملف الأصلي', () => {
    const names = [
      'الدليل الإجرائي لقرار توطين المهن الهندسية_1.pdf',
      'القواعد والإجراءات المنظمة لتسوية خلافات العمالة المنزلية.pdf',
      'تقرير ٢٠٢٦ — النسخة النهائية (معدّلة).docx',
      'résumé final.docx',
      '报告.xlsx',
      'file with spaces & symbols #1.csv',
      'plain-ascii-name.pdf',
      '.pdf',
      'بلا امتداد',
      '',
    ];

    for (const name of names) {
      expect(SUPABASE_KEY_RULE.test(storageKey(name)), name).toBe(true);
    }
  });

  it('يبقي الأسماء اللاتينية السليمة كما هي', () => {
    expect(safeStorageObjectName('plain-ascii-name.pdf')).toBe('plain-ascii-name.pdf');
    expect(safeStorageObjectName('report_2026.v2.xlsx')).toBe('report_2026.v2.xlsx');
  });

  it('يحفظ الامتداد حتى حين يذوب الاسم كله', () => {
    expect(safeStorageObjectName('الدليل الإجرائي.pdf')).toBe('document.pdf');
    expect(safeStorageObjectName('تقرير.docx')).toBe('document.docx');
  });

  it('يمنع Path Traversal ولا يُبقي أي فاصل مسار', () => {
    for (const attack of [
      '../../../etc/passwd',
      '..\\..\\windows\\system32\\config',
      '/absolute/path/secret.pdf',
      'a/../../b.pdf',
    ]) {
      const name = safeStorageObjectName(attack);
      expect(name).not.toContain('/');
      expect(name).not.toContain('\\');
      expect(name.startsWith('.')).toBe(false);
    }
  });

  it('لا يعيد اسمًا فارغًا أبدًا', () => {
    for (const name of ['', '...', '---', 'عربي', '   ']) {
      expect(safeStorageObjectName(name).length).toBeGreaterThan(0);
    }
  });

  it('يحدّ الطول فلا يتجاوز المفتاح حدود التخزين', () => {
    expect(safeStorageObjectName(`${'a'.repeat(500)}.pdf`)).toHaveLength(84);
  });
});
