import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * أهداف اللمس على الهاتف.
 *
 * كشفها فحصٌ آليّ على أربعة عروض، لا قراءةُ شيفرة: حبّات لوحة العرض
 * ثلاثون بكسلًا، وروابط الفوتر **ستّة عشر**.
 *
 * والإصبع أعرض من المؤشّر بكثير: الرابط بهذا الارتفاع يُخطأ إلى جاره
 * فوقه أو تحته، فيفتح الزائر صفحةً لم يقصدها ثم يرجع — ويتكرّر.
 *
 * ولا يظهر هذا في مراجعة على حاسب أبدًا.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const DEMO = read('src/components/marketing/demo-console.tsx');
const FOOTER = read('src/components/marketing/site-footer.tsx');

describe('ارتفاع كافٍ للّمس', () => {
  it('حبّات لوحة العرض ترتفع على الهاتف وتعود مضغوطة على الحاسب', () => {
    expect(DEMO).toMatch(/min-h-10[\s\S]{0,80}sm:min-h-0/);
  });

  it('روابط الفوتر كذلك', () => {
    expect(FOOTER).toMatch(/min-h-9[\s\S]{0,90}sm:min-h-0/);
  });

  it('الارتفاع يُطبَّق بعنصر يقبله — لا على `a` مضمّن', () => {
    // `min-h` على عنصر inline لا أثر له؛ يلزم inline-flex أو block
    expect(DEMO).toMatch(/inline-flex[\s\S]{0,60}min-h-10/);
    expect(FOOTER).toMatch(/inline-flex[\s\S]{0,60}min-h-9/);
  });
});

describe('الزينة لا تتجاوز الحافة', () => {
  it('هالة لوحة العرض داخل حاويتها', () => {
    // `-inset-x-10` كانت تُخرجها عن الشاشة على العروض الضيّقة
    expect(DEMO).not.toContain('-inset-x-10');
    expect(DEMO).toMatch(/animate-aurora[\s\S]{0,40}inset-x-0/);
  });

  it('وهي مخفيّة عن المؤشّر والقارئ الصوتيّ', () => {
    expect(DEMO).toMatch(/animate-aurora pointer-events-none/);
  });
});
