import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SITE_TEXT } from '@/content/site-text';

/**
 * مسار الطلب في قسم الأمان.
 *
 * كان أربع بطاقات متجاورة تُقرأ قائمةَ مزايا. والقائمة تقول «عندنا
 * هذا» ولا تقول **متى يقع** — والترتيب هو الحجّة: الصلاحية تُفحص قبل
 * بناء السياق لا بعده، والعزل في القاعدة لا في الشيفرة.
 *
 * ولأن كل مرحلة ادّعاءٌ أمنيّ، فالحارس يشترط أن يقابلها شيءٌ قائم في
 * الشيفرة — لا وصفٌ حسن الصياغة.
 */

const FLOW = readFileSync(
  join(process.cwd(), 'src/components/marketing/security-flow.tsx'),
  'utf8',
);
const PAGE = readFileSync(join(process.cwd(), 'src/app/(marketing)/page.tsx'), 'utf8');

const stages = SITE_TEXT['home.security.flow'].value as { stage: string; detail: string }[];

describe('المراحل الأربع', () => {
  it('أربع مراحل: عزل ⇐ سياسات ⇐ صلاحية ⇐ تدقيق', () => {
    expect(stages.length).toBe(4);
  });

  it('النصّ في السجلّ لا في المكوّن', () => {
    expect(PAGE).toContain("t.list('home.security.flow')");
    for (const item of stages) expect(FLOW).not.toContain(item.stage);
  });

  it('لكل مرحلة شرحٌ يقول متى تقع لا ماذا تكون', () => {
    for (const item of stages) expect(item.detail.length).toBeGreaterThan(30);
  });
});

describe('ما تدّعيه المراحل قائمٌ في الشيفرة', () => {
  it('العزل يُشتقّ في القاعدة من هويّة المستخدم', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/ALL_MIGRATIONS.sql'), 'utf8');
    expect(sql).toContain('auth.uid()');
    expect(sql).toMatch(/select company_id[\s\S]{0,80}where id = auth\.uid\(\)/);
  });

  it('سياسات على مستوى الصفّ مفعَّلة', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/ALL_MIGRATIONS.sql'), 'utf8');
    expect(sql).toMatch(/enable row level security/i);
  });

  it('صلاحية المستند تُفحص داخل الاسترجاع لا بعده', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/ALL_MIGRATIONS.sql'), 'utf8');
    // الشرط داخل الاستعلام الذي يجلب المقاطع، فلا يُقرأ ثم يُحجب
    expect(sql).toMatch(/d\.visibility = 'COMPANY'/);
  });

  it('سجلّ التدقيق موجود', () => {
    const sql = readFileSync(join(process.cwd(), 'supabase/ALL_MIGRATIONS.sql'), 'utf8');
    expect(sql).toMatch(/create table if not exists public\.audit_logs/);
  });
});

describe('الرسم خفيف ومقروء', () => {
  it('بلا صورة ولا مكتبة رسم', () => {
    expect(FLOW).not.toMatch(/<img|<svg\s|from 'framer-motion'|d3|chart/i);
  });

  it('الأسهم مخفيّة عن القارئ الصوتيّ — زخرفةٌ لا معنى', () => {
    expect(FLOW).toMatch(/aria-hidden[\s\S]{0,120}ArrowLeft/);
  });

  it('قائمة مرتّبة — الترتيب معنًى لا شكل', () => {
    expect(FLOW).toContain('<ol');
  });
});
