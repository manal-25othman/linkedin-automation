import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * حارس: المؤشّر المعطَّل يقول إنه معطَّل.
 *
 * كانت بطاقتا التكلفة تعرضان «٠ ريال» حين يتعذّر التقرير، بينما تعرض
 * بطاقتا الإيراد والربح «—». فقرأت المالكة «لا تكلفة ذكاء عليّ» وهي
 * تستعمل المنصّة فعلًا، وسألت عن سبب غياب التكلفة — بدل أن تُخبَر أن
 * التقرير نفسه لم يعمل.
 *
 * والصفر هنا **ادّعاء بأن القياس تمّ ولم يجد شيئًا**، وهو أسوأ من
 * الفراغ: الفراغ يدفع إلى السؤال، والصفر يُطمئن كذبًا.
 *
 * والمبدأ نفسه مكتوب في `src/app/admin/page.tsx` منذ عطلٍ سابق —
 * وخُولف هنا. فصار حارسًا لا تعليقًا.
 */

const FINANCE = readFileSync(
  join(process.cwd(), 'src/app/admin/finance/page.tsx'),
  'utf8',
);

describe('التقرير المالي حين يتعذّر', () => {
  it('يُميَّز «تعذّر القياس» عن «قِيس فكان صفرًا»', () => {
    expect(FINANCE).toContain('reportUnavailable');
  });

  it('صفرُ الصفوف يُعدّ تعذّرًا لا فراغًا', () => {
    // الدالّة تُنشئ صفوف الأشهر بـgenerate_series، فهي تُرجع صفًّا لكل
    // شهر ولو لم يكن في القاعدة معطًى واحد. فصفرُ الصفوف = لم يُقرأ شيء
    expect(FINANCE).toMatch(/months\.length === 0/);
  });

  it('البطاقات الأربع كلّها تُخفي رقمها عند التعذّر', () => {
    // ولا تُترك بطاقة واحدة تعرض صفرًا بينما أخواتها تعرض «غير متاح»
    const cards = FINANCE.split('<StatCard');
    expect(cards.length).toBe(5); // النصّ قبل الأولى + أربع بطاقات

    for (const card of cards.slice(1)) {
      expect(card, 'بطاقة لا تراعي تعذّر التقرير').toMatch(
        /reportUnavailable|shown\(/,
      );
    }
  });

  it('يُعرض تنبيه صريح يقول ما يُفعَل', () => {
    expect(FINANCE).toContain('تعذّر قراءة التقرير المالي');
    expect(FINANCE).toContain('ALL_MIGRATIONS.sql');
  });

  it('لا يُعرض تحذير المصاريف حين لا يُعرف شيء أصلًا', () => {
    // «الربح أعلاه أكبر مما هو» يفترض أن ربحًا حُسب — ولم يُحسب
    const warningIndex = FINANCE.indexOf('لم تُدخَل أي مصاريف ثابتة');
    const guardIndex = FINANCE.indexOf('{reportUnavailable ? (');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(warningIndex);
  });
});

describe('المبدأ نفسه محفوظ في صفحة النظرة العامة', () => {
  const OVERVIEW = readFileSync(join(process.cwd(), 'src/app/admin/page.tsx'), 'utf8');

  it('مؤشّرات الزوّار تُميّز التعذّر عن الصفر', () => {
    // الضابط الموجب: لولاه لصار هذا الملف يحرس صفحةً واحدة
    expect(OVERVIEW).toContain('visitorsUnavailable');
    expect(OVERVIEW).toContain('غير متاح');
  });
});
