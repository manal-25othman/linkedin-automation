import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * قياس الرضا.
 *
 * التقييم (إبهام مرفوع/مخفوض) كان موجودًا، وعمود `feedback_note` معه
 * منذ أول ترحيلة — **ولم يُكتب فيه شيء قطّ**، لأن الواجهة لم تكن تسأل
 * عن السبب.
 *
 * فكان الرقم يقول «كم غير راضٍ» ولا يقول لماذا، وهو أنفع ما فيه.
 *
 * وأخطر ما في هذه الإضافة ليس تقنيًّا: السبب نصٌّ يكتبه موظفٌ في شركةٍ
 * عميلة، ويصل إلى مالك المنصّة. وهذا تجاوزٌ مقصود لحدّ العزل المطبَّق
 * في كل ما عداه — فيلزمه شرطان: إفصاحٌ للكاتب، وأقلّ قدرٍ ممكن.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const CHAT = read('src/components/dashboard/assistant/chat.tsx');
const SERVICE = read('src/lib/ai/chat-service.ts');
const ACTIONS = read('src/app/(dashboard)/assistant/actions.ts');
const ADMIN = read('src/app/admin/page.tsx');
const SQL = read('supabase/ALL_MIGRATIONS.sql');

describe('السبب يُجمع ويُحفظ', () => {
  it('«لم تعجبني» وحدها تفتح الحقل', () => {
    expect(CHAT).toContain("setAskingWhy(next === 'DOWN')");
  });

  it('التقييم يُحفظ قبل السبب — من ضغط ثم انصرف يبقى رأيه محسوبًا', () => {
    expect(CHAT).toMatch(/setFeedback\(next\)[\s\S]{0,200}feedbackAction\(message\.id, next\)/);
  });

  it('السبب يمرّ إلى الخدمة', () => {
    expect(ACTIONS).toContain('submitFeedback(messageId, feedback, note)');
    expect(SERVICE).toMatch(/note\?: string \| null/);
  });

  it('السبب يُمحى إن رُفع الإبهام بعده', () => {
    // وإلا بقي سببُ استياءٍ معلّقًا على إجابةٍ رضي عنها صاحبها
    expect(SERVICE).toMatch(/feedback === 'DOWN'[\s\S]{0,140}feedback_note: null/);
  });

  it('طوله محدود — الحقل للتوضيح لا للمراسلة', () => {
    expect(SERVICE).toContain('MAX_FEEDBACK_NOTE');
    expect(CHAT).toContain('maxLength={500}');
  });
});

describe('الإفصاح قبل الجمع', () => {
  it('الكاتب يُخبَر إلى أين يذهب ما يكتبه', () => {
    expect(CHAT).toContain('يصل إلى فريق المنصة');
  });

  it('الحقل اختياريّ ويمكن تخطّيه', () => {
    expect(CHAT).toContain('(اختياري)');
    expect(CHAT).toContain('تخطٍّ');
  });
});

describe('أقلّ قدرٍ ممكن يصل إلى مالك المنصّة', () => {
  it('الدالّة تُرجع السبب واسم الشركة والتاريخ وحدها', () => {
    const fn = SQL.slice(SQL.indexOf('function public.platform_feedback_notes'));
    const head = fn.slice(0, fn.indexOf('language plpgsql'));
    expect(head).toContain('note');
    expect(head).toContain('company_name');
    // لا نصّ سؤال ولا إجابة ولا اسم كاتب
    expect(head).not.toMatch(/content|question|answer|full_name|email|user_id/);
  });

  it('مالك المنصّة وحده — والدالّة تتحقّق بنفسها لا بالواجهة', () => {
    const fn = SQL.slice(SQL.indexOf('function public.platform_feedback_notes'));
    expect(fn.slice(0, 1400)).toContain('is_super_admin()');
  });

  it('المقياس محروسٌ كذلك', () => {
    const fn = SQL.slice(SQL.indexOf('function public.platform_satisfaction'));
    expect(fn.slice(0, 1400)).toContain('is_super_admin()');
  });
});

describe('العرض لا يكذب حين لا بيانات', () => {
  it('«لا تقييمات بعد» لا صفرٌ يوهم أن القياس تمّ', () => {
    expect(ADMIN).toContain('لا تقييمات بعد');
    expect(ADMIN).toMatch(/Number\(satisfaction\.total_rated\) > 0/);
  });
});
