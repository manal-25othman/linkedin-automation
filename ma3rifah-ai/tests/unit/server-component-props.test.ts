import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * حارس ثابت ضدّ تمرير دالة من مكوّن خادم إلى مكوّن عميل.
 *
 * الدالة المُنشأة داخل مكوّن خادم — `action={() => doThing(id)}` — ليست
 * إجراءً خادميًا بل إغلاق (closure) لا يُسلسَل، فيرمي Next عند العرض
 * ويسقط الصفحة كاملة بخطأ 500. والعطل لا يظهر في البناء ولا في فحص
 * الأنواع: الصفحة تُبنى بنجاح ثم تموت عند أول طلب حقيقي — وهكذا بقيت
 * صفحة «الشركات» في لوحة إدارة المنصة معطّلة بلا أن يشتكي شيء.
 *
 * البديل الصحيح `doThing.bind(null, id)` — مرجع خادمي قابل للتسلسل.
 *
 * الفحص نصّي لأن الخطأ نصّي الطابع: نمط كتابة يُنسخ من ملف عميل إلى
 * ملف خادم فيصير عطلًا. ولأنه يقع في زمن التشغيل وحده، فلا يمسكه
 * مترجم ولا مُدقِّق أنواع.
 */

const APP_DIR = join(process.cwd(), 'src/app');

/** `action={(…) => …}` أو نظيره غير المتزامن، بأي مسافات بينها */
const INLINE_FUNCTION_PROP = /\b(action|onAction)=\{\s*(async\s*)?\(/;

function collectTsxFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectTsxFiles(path));
    } else if (entry.name.endsWith('.tsx')) {
      found.push(path);
    }
  }
  return found;
}

/** مكوّن العميل يُعلن عن نفسه في أول سطر غير فارغ */
function isClientComponent(source: string): boolean {
  const firstLine = source.split('\n').find((line) => line.trim().length > 0) ?? '';
  return /^['"]use client['"]/.test(firstLine.trim());
}

describe('خصائص مكوّنات الخادم', () => {
  it('لا يمرّر مكوّن خادم دالة ضمنية إلى مكوّن عميل', () => {
    const offenders = collectTsxFiles(APP_DIR)
      .filter((path) => {
        const source = readFileSync(path, 'utf8');
        return !isClientComponent(source) && INLINE_FUNCTION_PROP.test(source);
      })
      .map((path) => relative(process.cwd(), path));

    expect(offenders).toEqual([]);
  });

  it('يمسك الحارسُ النمطَ الخاطئ ويقبل الصحيح — ضبطٌ للفحص نفسه', () => {
    // بلا هذا قد يمرّ الاختبار الأول لأن التعبير النمطي لا يطابق شيئًا
    expect(INLINE_FUNCTION_PROP.test('action={() => setStatus(id)}')).toBe(true);
    expect(INLINE_FUNCTION_PROP.test('action={async () => doThing()}')).toBe(true);
    expect(INLINE_FUNCTION_PROP.test('action={ () => x() }')).toBe(true);

    expect(INLINE_FUNCTION_PROP.test('action={setStatus.bind(null, id)}')).toBe(false);
    expect(INLINE_FUNCTION_PROP.test('action={inviteUserAction}')).toBe(false);
  });
});
