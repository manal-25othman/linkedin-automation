import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * حارس: كل صفحة تحت `/admin` تحرس نفسها.
 *
 * التخطيط (`layout.tsx`) يعيد توجيه غير المالك، وهو حاجز حقيقي — لكنه
 * حاجزٌ واحد. وصفحةٌ تعتمد عليه وحده تنكشف بأي خطأ في التخطيط أو أي
 * مسار يلتفّ عليه. والصفحة المالية أخطرها: تكشف إيرادات كل الشركات
 * وأرباحها دفعةً واحدة.
 *
 * فيلزم الحارسان معًا: التخطيط، و`requireSuperAdmin()` في الصفحة نفسها
 * — ومعهما التحقّق داخل دوالّ القاعدة، فتصير ثلاث طبقات لا واحدة.
 */

const ADMIN_ROOT = join(process.cwd(), 'src/app/admin');

function pageFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      found.push(...pageFiles(path));
    } else if (entry === 'page.tsx' || entry === 'route.ts') {
      found.push(path);
    }
  }
  return found;
}

describe('حراسة مسارات إدارة المنصّة', () => {
  it('التخطيط يعيد توجيه من ليس مالك منصّة', () => {
    const layout = readFileSync(join(ADMIN_ROOT, 'layout.tsx'), 'utf8');
    expect(layout).toContain("role !== 'SUPER_ADMIN'");
    expect(layout).toContain('redirect');
  });

  it('توجد صفحات أصلًا — وإلا فالحارس يحرس فراغًا', () => {
    expect(pageFiles(ADMIN_ROOT).length).toBeGreaterThanOrEqual(6);
  });

  it('كل صفحة تستدعي requireSuperAdmin بنفسها', () => {
    const unguarded = pageFiles(ADMIN_ROOT)
      .filter((file) => !readFileSync(file, 'utf8').includes('requireSuperAdmin('))
      .map((file) => file.replace(process.cwd(), ''));

    expect(unguarded, 'الاعتماد على التخطيط وحده حاجز واحد لا حاجزان').toEqual([]);
  });

  it('الصفحة المالية موجودة وتقرأ الدوالّ بجلسة المستخدم لا بمفتاح الخدمة', () => {
    const finance = join(ADMIN_ROOT, 'finance/page.tsx');
    expect(existsSync(finance)).toBe(true);

    const source = readFileSync(finance, 'utf8');
    // مفتاح الخدمة يجعل auth.uid() فارغًا فترفض الدالّة التحقّق من الدور
    expect(source).toMatch(/sessionClient\.rpc\('platform_finance_summary'/);
    expect(source).toMatch(/sessionClient\.rpc\('platform_company_pnl'/);
  });
});
