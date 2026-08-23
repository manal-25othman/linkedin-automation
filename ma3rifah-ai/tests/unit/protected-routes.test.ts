import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * حارس: كل مسار في اللوحة مُدرَج في قائمة الحماية.
 *
 * المسار الغائب عن القائمة لا يُحوَّل إلى صفحة الدخول، فيصل الزائر
 * المجهول إلى الصفحة ويرمي حارسُها خطأً غير معالَج — فيرى **500** بدل
 * صفحة دخول. وهو عطلٌ يبدو خللًا في المنصة لا حمايةً تعمل.
 *
 * ولا خطر تسريبٍ فيه (الحارس داخل الصفحة يمنع البيانات)، لكنه انطباع
 * سيّئ في أسوأ لحظة: أول زيارة لرابط شاركه زميل.
 *
 * وقد وقع فعلًا عند إضافة `/help`: نُسي إدراجه فأعطى 500، وأمسكه فحصُ
 * دخان بطلب حقيقي لا اختبارُ وحدة. وهذا الحارس يمسكه قبل ذلك.
 */

const DASHBOARD_DIR = join(process.cwd(), 'src/app/(dashboard)');
const MIDDLEWARE = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf8');

/** المسارات العليا تحت مجموعة اللوحة — بلا المسارات الديناميكية */
function topLevelRoutes(): string[] {
  return readdirSync(DASHBOARD_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('['))
    .map((entry) => `/${entry.name}`);
}

const ROUTES = topLevelRoutes();

describe('حماية مسارات اللوحة', () => {
  it('الفحص يرى مسارات فعلًا — ضابط موجب', () => {
    expect(ROUTES.length).toBeGreaterThan(8);
  });

  it('كل مسار لوحة مُدرَج في قائمة الحماية', () => {
    const missing = ROUTES.filter((route) => !MIDDLEWARE.includes(`'${route}'`));
    expect(missing).toEqual([]);
  });

  it('لوحة المنصة محميّة كذلك', () => {
    expect(MIDDLEWARE).toContain("'/admin'");
  });

  it('الحارس يمسك مسارًا غير مُدرَج — ضبط سلبي', () => {
    expect(MIDDLEWARE.includes("'/masar-jadid-lam-yudraj'")).toBe(false);
  });
});
