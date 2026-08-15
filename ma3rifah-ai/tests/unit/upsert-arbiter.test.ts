import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * حارس ضدّ فهرس فريد جزئي يُستعمل مُحكِّمًا لـ ON CONFLICT.
 *
 * كل `upsert(..., { onConflict: 'a,b,c' })` يترجَم إلى
 * `insert … on conflict (a, b, c)`. وPostgres لا يقبل فهرسًا جزئيًا
 * (‏`create unique index … where …`) مُحكِّمًا لهذه الصيغة، فيردّ الخطأ
 * 42P10 ويفشل كل إدراج.
 *
 * وهذا العطل من أخبث ما يكون: قاعدة البيانات سليمة، والجدول موجود،
 * والفهرس موجود، والشيفرة صحيحة في ظاهرها — ولا شيء يعمل. وقد ابتلعت
 * طبقةُ التنبيهات الخطأَ (بحقّ: تنبيه ضائع لا يجوز أن يُفشل عملية نجحت)
 * فبقي النظام يقول «تم الحفظ» ولا يصل أحدًا تنبيه، شهورًا لو لم يُلاحَظ.
 *
 * الفحص نصّي لأنه يقابل بين مصدرين لا يعرف أحدهما الآخر: أسماء الأعمدة
 * في TypeScript، وتعريف الفهرس في SQL. لا مترجم يربط بينهما.
 */

const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations');
const SRC_DIR = join(process.cwd(), 'src');

interface UniqueIndex {
  name: string;
  table: string;
  columns: string[];
  isPartial: boolean;
  file: string;
}

/** `create unique index [if not exists] <اسم> on <جدول> (<أعمدة>) [where …];` */
const UNIQUE_INDEX = /create\s+unique\s+index\s+(?:if\s+not\s+exists\s+)?(\w+)\s+on\s+([\w.]+)\s*\(([^)]*)\)([^;]*);/gi;

function readMigrations(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => `-- FILE:${name}\n${readFileSync(join(MIGRATIONS_DIR, name), 'utf8')}`);
}

/**
 * آخر تعريف لكل فهرس هو النافذ — الترحيلات تُطبَّق بالترتيب، وترحيل
 * لاحق قد يُسقط فهرسًا ويعيد إنشاءه.
 */
function collectUniqueIndexes(): Map<string, UniqueIndex> {
  const indexes = new Map<string, UniqueIndex>();

  for (const content of readMigrations()) {
    const file = content.match(/^-- FILE:(.+)$/m)?.[1] ?? '';
    // تُزال التعليقات كي لا يُلتقط تعريف مذكور في شرح
    const sql = content.replace(/--[^\n]*/g, '');

    for (const match of sql.matchAll(UNIQUE_INDEX)) {
      const [, name, table, columnList, tail] = match;
      indexes.set(name, {
        name,
        table: table.replace(/^public\./, ''),
        columns: columnList.split(',').map((column) => column.trim()),
        isPartial: /\bwhere\b/i.test(tail),
        file,
      });
    }
  }

  return indexes;
}

/** كل `onConflict: '…'` مع اسم الجدول المستهدف من `.from('…')` قبله */
function collectUpsertTargets(): { table: string; columns: string[]; file: string }[] {
  const targets: { table: string; columns: string[]; file: string }[] = [];

  const walk = (directory: string): string[] => {
    const files: string[] = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) files.push(...walk(path));
      else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) files.push(path);
    }
    return files;
  };

  for (const path of walk(SRC_DIR)) {
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(/onConflict:\s*'([^']+)'/g)) {
      const before = source.slice(0, match.index);
      const table = [...before.matchAll(/\.from\('([^']+)'\)/g)].pop()?.[1];
      if (!table) continue;
      targets.push({
        table,
        columns: match[1].split(',').map((column) => column.trim()),
        file: path,
      });
    }
  }

  return targets;
}

const sameColumns = (a: string[], b: string[]) =>
  a.length === b.length && a.every((column, index) => column === b[index]);

describe('مُحكِّم ON CONFLICT', () => {
  const indexes = collectUniqueIndexes();
  const targets = collectUpsertTargets();

  it('يجد أهداف الـ upsert فعلًا — ضبطٌ للفحص نفسه', () => {
    // بلا هذا يمرّ الاختبار التالي لأنه لم يفحص شيئًا
    expect(targets.length).toBeGreaterThan(0);
    expect(indexes.size).toBeGreaterThan(0);
  });

  it('كل upsert يقابله فهرس فريد غير جزئي', () => {
    const problems: string[] = [];

    for (const target of targets) {
      // مفتاح أساسي أو عمود unique يكفي، ولا يظهر كفهرس مستقل
      const candidates = [...indexes.values()].filter(
        (index) => index.table === target.table && sameColumns(index.columns, target.columns),
      );

      for (const candidate of candidates) {
        if (candidate.isPartial) {
          problems.push(
            `${candidate.name} (${candidate.file}) فهرس جزئي ولا يصلح مُحكِّمًا لـ ` +
              `onConflict: '${target.columns.join(',')}' على ${target.table}`,
          );
        }
      }
    }

    expect(problems).toEqual([]);
  });
});
