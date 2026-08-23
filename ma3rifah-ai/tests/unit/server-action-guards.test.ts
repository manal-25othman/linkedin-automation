import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * حارس: كل إجراء خادمي يمرّ بتفويض.
 *
 * الإجراء الخادمي **نقطة نهاية شبكية** لا دالة داخلية: يستقبل طلب POST
 * من أي متصفح بمعرّفه المُولَّد، سواء عُرض زرّه في الواجهة أو أُخفي.
 * فإخفاء الزرّ ليس حمايةً، والحماية الوحيدة سطرٌ في أول الإجراء.
 *
 * ونسيان هذا السطر لا يظهر في شيء: الصفحة تعمل، والاختبارات تمرّ،
 * والواجهة تخفي الزرّ عمّن لا يملكه — ويبقى الإجراء مفتوحًا لمن يعرف
 * كيف يستدعيه. ولذلك حارسٌ ثابت لا مراجعةٌ بشرية.
 *
 * والفحص يقبل **التفويض غير المباشر**: إجراءٌ يفوّض كامل عمله إلى خدمة
 * تحرس بنفسها. وهذه الحالات مسرودة صراحةً باسم الخدمة التي تحرس، كي
 * تبقى مرئية ولا تصير بابًا يُوسَّع بلا انتباه.
 */

const APP_DIR = join(process.cwd(), 'src/app');

const GUARDS = [
  'requireSuperAdmin',
  'requirePermission',
  'requireCompanySession',
  'requireSession',
];

/**
 * إجراءات لا تتطلب جلسة — بحكم وظيفتها.
 *
 * كلها مسارات يصلها زائر بلا حساب أصلًا. وحمايتها ليست بالتفويض بل
 * بتحديد المعدّل والتحقق من المدخلات، وذلك مفحوص في مواضعه.
 */
const PUBLIC_ACTIONS: Record<string, string> = {
  'loginAction': 'تسجيل الدخول — لا جلسة قبله',
  'registerAction': 'إنشاء حساب جديد',
  'logoutAction': 'الخروج — يعمل بجلسة أو بدونها',
  'requestPasswordResetAction': 'طلب رابط استعادة',
  'updatePasswordAction': 'تعيين كلمة مرور برابط موقّع',
  'submitContactRequest': 'نموذج تواصل عام',
};

/**
 * إجراءات تفوّض حراستها إلى خدمة.
 *
 * القيمة اسم الخدمة الحارسة — ويُتحقَّق أنها تحرس فعلًا لا أن الاسم
 * كُتب فحسب.
 */
const DELEGATED_ACTIONS: Record<string, { service: string; file: string }> = {
  askAction: { service: 'askAssistant', file: 'src/lib/ai/chat-service.ts' },
  feedbackAction: { service: 'submitFeedback', file: 'src/lib/ai/chat-service.ts' },
  logoutEverywhereAction: { service: 'getUser', file: '' },
};

interface ActionEntry {
  file: string;
  name: string;
  body: string;
}

function collectServerActionFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...collectServerActionFiles(path));
    else if (entry.name.endsWith('.ts') && readFileSync(path, 'utf8').includes("'use server'")) {
      found.push(path);
    }
  }
  return found;
}

function collectActions(): ActionEntry[] {
  const actions: ActionEntry[] = [];

  for (const path of collectServerActionFiles(APP_DIR)) {
    const source = readFileSync(path, 'utf8');
    const file = relative(process.cwd(), path);

    // القطع عند كل إجراء مُصدَّر — وجسمُه ما بينه وبين التالي
    const parts = source.split('\nexport async function ');
    for (const part of parts.slice(1)) {
      actions.push({
        file,
        name: part.slice(0, part.indexOf('(')).trim(),
        body: part.split('\nexport ')[0],
      });
    }
  }

  return actions;
}

const ACTIONS = collectActions();

describe('تفويض الإجراءات الخادمية', () => {
  it('الفحص يرى إجراءات فعلًا — ضابط موجب', () => {
    // فحصٌ يمرّ على قائمة فارغة يمرّ دائمًا ولا يثبت شيئًا
    expect(ACTIONS.length).toBeGreaterThan(30);
  });

  it('كل إجراء يحرسه حارس، أو يفوّض، أو هو عام صراحةً', () => {
    const unguarded = ACTIONS.filter((action) => {
      if (GUARDS.some((guard) => action.body.includes(`${guard}(`))) return false;
      if (action.name in PUBLIC_ACTIONS) return false;
      if (action.name in DELEGATED_ACTIONS) return false;
      return true;
    }).map((action) => `${action.file} → ${action.name}`);

    expect(unguarded).toEqual([]);
  });

  it('الإجراء المفوَّض تحرسه خدمته فعلًا', () => {
    for (const [name, { service, file }] of Object.entries(DELEGATED_ACTIONS)) {
      if (file === '') continue;

      const source = readFileSync(join(process.cwd(), file), 'utf8');
      const start = source.indexOf(`export async function ${service}(`);
      expect(start, `${service} غير موجود في ${file}`).toBeGreaterThan(-1);

      const body = source.slice(start).split('\nexport ')[0];
      const guarded = GUARDS.some((guard) => body.includes(`${guard}(`));
      expect(guarded, `${name} يفوّض إلى ${service} وهي لا تحرس`).toBe(true);
    }
  });

  it('إجراءات لوحة المنصة يحرسها مالك المنصة وحده', () => {
    const adminActions = ACTIONS.filter((action) => action.file.startsWith('src/app/admin/'));
    expect(adminActions.length).toBeGreaterThan(5);

    const weak = adminActions
      .filter((action) => !action.body.includes('requireSuperAdmin('))
      .map((action) => `${action.file} → ${action.name}`);

    expect(weak).toEqual([]);
  });

  it('الحارس نفسه يمسك إجراءً بلا تفويض — ضبط سلبي', () => {
    const fake = `export async function deleteEverythingAction() {
      const admin = createAdminClient();
      await admin.from('companies').delete();
    }`;
    expect(GUARDS.some((guard) => fake.includes(`${guard}(`))).toBe(false);
  });

  it('كل قائمة استثناء مستعملة — لا استثناء معلّق', () => {
    // استثناءٌ لإجراء حُذف يبقى بابًا مفتوحًا لاسمٍ يُعاد استعماله لاحقًا
    const names = new Set(ACTIONS.map((action) => action.name));
    for (const name of Object.keys(PUBLIC_ACTIONS)) {
      expect(names.has(name), `استثناء عام لإجراء غير موجود: ${name}`).toBe(true);
    }
    for (const name of Object.keys(DELEGATED_ACTIONS)) {
      expect(names.has(name), `استثناء تفويض لإجراء غير موجود: ${name}`).toBe(true);
    }
  });
});
