import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * حارس: كل نداء لتحديد المعدّل يُنتظَر.
 *
 * صار `enforceRateLimit` غير متزامن حين انتقل العدّاد إلى القاعدة.
 * وستّة مواضع كانت تستدعيه بلا `await` — **ولم يشكُ منها المترجم**، لأن
 * إهمال وعدٍ مرفوعٍ تعبيرٌ صحيح نحويًا. والنتيجة أنّ الدالة تُستدعى ثم
 * يمضي الطلب قبل أن يصل جوابها، فلا تمنع شيئًا أبدًا.
 *
 * وهذا أخطر أنواع العطل: الحماية مكتوبة في الشيفرة، ظاهرة لمن يقرأ،
 * ومعطَّلة تمامًا في التشغيل. ولا اختبار وحدة يكشفها لأن السلوك المرصود
 * — «لم يُمنع أحد» — هو نفسه السلوك السليم في كل حالة لا تتجاوز الحدّ.
 *
 * فالحارس ثابت يقرأ الشيفرة نصًّا: لا موضع نداء إلا مسبوقًا بـ`await`
 * أو مُعادًا بـ`return`.
 */

const SOURCE_ROOT = join(process.cwd(), 'src');
const LIMITER_FILE = join('lib', 'rate-limit.ts');

function sourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(path));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      found.push(path);
    }
  }
  return found;
}

interface CallSite {
  file: string;
  line: number;
  text: string;
  /** true حين يقع النداء داخل `await Promise.all([...])` ممتدّ على أسطر */
  inAwaitedGroup: boolean;
}

/** مواضع النداء خارج وحدة التحديد نفسها */
function callSites(): CallSite[] {
  const sites: CallSite[] = [];

  for (const file of sourceFiles(SOURCE_ROOT)) {
    if (file.endsWith(LIMITER_FILE)) continue;

    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((text, index) => {
      // يُتجاهَل سطر الاستيراد — ليس نداءً
      if (/^\s*import\b/.test(text)) return;
      if (!/\b(enforceRateLimit|checkRateLimit)\s*\(/.test(text)) return;

      // النداء قد يكون عنصرًا في `await Promise.all([` فُتحت قبله بأسطر.
      // والنظر إلى ثلاثة أسطر يكفي لهذا النمط ولا يبتلع نطاقًا بعيدًا
      // فيُخفي نداءً مهملًا حقًّا.
      const preceding = lines.slice(Math.max(0, index - 3), index).join('\n');

      sites.push({
        file: file.replace(process.cwd(), ''),
        line: index + 1,
        text,
        inAwaitedGroup: /await\s+Promise\.(all|allSettled)\s*\(\s*\[/.test(preceding),
      });
    });
  }

  return sites;
}

describe('حارس await على تحديد المعدّل', () => {
  it('توجد مواضع نداء أصلًا — وإلا فالحارس يحرس فراغًا', () => {
    // ضابط موجب: لو نُقلت الدوال أو أُعيدت تسميتها لصار الحارس يمرّ
    // دائمًا وهو لا يفحص شيئًا
    expect(callSites().length).toBeGreaterThanOrEqual(8);
  });

  it('كل نداء مسبوق بـ await أو return أو داخل مجموعة مُنتظَرة', () => {
    const unawaited = callSites().filter(
      (site) =>
        !site.inAwaitedGroup && !/\b(await|return)\s+[a-zA-Z[]/.test(site.text),
    );

    expect(
      unawaited.map((site) => `${site.file}:${site.line} → ${site.text.trim()}`),
      'نداء بلا await لا يمنع شيئًا، ولا يشكو منه المترجم',
    ).toEqual([]);
  });

  it('لا نداء داخل Promise.all بلا await على المجموعة', () => {
    // `Promise.all([...])` بلا await يعيد وعدًا مهملًا كسابقه
    for (const site of callSites()) {
      if (site.text.includes('Promise.all')) {
        expect(site.text, `${site.file}:${site.line}`).toMatch(/await\s+Promise\.all/);
      }
    }
  });
});
