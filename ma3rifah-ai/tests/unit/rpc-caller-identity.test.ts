import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * حارس: الدالّة التي تسأل «من أنت؟» لا تُنادى بمفتاح الخدمة.
 *
 * العطل الذي أنتج هذا الحارس وقع فعلًا: دالّة معاينة المكتبة المرجعية
 * تشترط `is_super_admin()`، ونوديت بـ`createAdminClient()`. ومفتاح
 * الخدمة بلا هوية مستخدم، فـ`auth.uid()` فارغة، فالشرط يفشل، **فتُرجع
 * الدالّة صفرًا من الصفوف بلا خطأ**.
 *
 * وهذا أسوأ شكل يمكن أن يتخذه عطل:
 *
 *   • لا استثناء يُرمى، ولا رسالة خطأ، ولا سطر في السجلّ.
 *   • الواجهة تعرض فراغًا، والفراغ يُقرأ «لم يُفهرس شيء».
 *   • فيُشخَّص العطل في المكان الخطأ — في الفهرسة التي نجحت فعلًا.
 *
 * ولا يمسكه اختبار SQL: الدالّة سليمة تمامًا وتعمل كما يجب حين تُنادى
 * بجلسة مستخدم. الخلل في **من ينادي**، وهو في TypeScript.
 *
 * فالفحص هنا بنيويّ: تُستخرج من الترحيلات كل دالّة يعتمد سلوكها على
 * هوية المنادي، ثم يُتأكد أن أحدًا لا ينادي واحدةً منها بمفتاح الخدمة.
 */

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, 'supabase/migrations');
const SRC = join(ROOT, 'src');

/** ما يجعل سلوك الدالّة متوقفًا على هوية المنادي */
const IDENTITY_MARKERS = [
  'auth.uid()',
  'is_super_admin()',
  'is_company_admin()',
  'is_manager_or_above()',
  'current_company_id()',
  'belongs_to_current_company(',
];

/** أسماء الدوالّ التي يتغيّر ناتجها بتغيّر المنادي */
function identityDependentFunctions(): Set<string> {
  const found = new Set<string>();

  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');

    // كل تعريف دالّة وجسمه حتى نهاية الكتلة
    const pattern =
      /create\s+(?:or\s+replace\s+)?function\s+public\.([a-z_0-9]+)\s*\(([\s\S]*?)\$\$;/gi;

    for (const match of sql.matchAll(pattern)) {
      const name = match[1];
      const body = match[2];
      if (IDENTITY_MARKERS.some((marker) => body.includes(marker))) {
        found.add(name);
      }
    }
  }

  return found;
}

/** كل ملفات المصدر */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe('هوية منادي دوالّ القاعدة', () => {
  const identityFunctions = identityDependentFunctions();

  it('تُستخرج دوالّ الهوية من الترحيلات فعلًا', () => {
    // ضابط موجب: لو انكسر الاستخراج لمرّ الحارس كله بلا فحص
    expect(identityFunctions.size).toBeGreaterThan(5);
    expect(identityFunctions.has('is_super_admin')).toBe(true);
  });

  it('لا تُنادى دالّة تعتمد على هوية المنادي بمفتاح الخدمة', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      const code = readFileSync(file, 'utf8');

      // الملف الذي لا يستورد مفتاح الخدمة أصلًا خارج الشبهة
      if (!code.includes('createAdminClient')) continue;

      /*
       * العُرف في هذا المشروع ثابت:
       *   const admin    = createAdminClient();   ← مفتاح الخدمة
       *   const supabase = await createClient();  ← جلسة المستخدم
       * فيُفحص كل `admin.rpc('…')`.
       */
      for (const call of code.matchAll(/\badmin\s*\.\s*rpc\(\s*['"]([a-z_0-9]+)['"]/gi)) {
        const fn = call[1];
        if (identityFunctions.has(fn)) {
          offenders.push(`${file.replace(ROOT + '/', '')} → ${fn}`);
        }
      }
    }

    expect(
      offenders,
      'دالّة تسأل عن هوية المنادي نوديت بمفتاح الخدمة — سترجع فراغًا بلا ' +
        'خطأ، ويُقرأ الفراغ عطلًا في موضع آخر:\n' +
        offenders.join('\n'),
    ).toEqual([]);
  });
});
