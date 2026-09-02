import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * دعوة الاستبيان داخل المساعد.
 *
 * تظهر بعد خمس إجابات فعلية للمستخدم نفسه، وتُغلق فلا تعود. والخطر
 * فيها اثنان: أن تصير إزعاجًا يُغلق قبل أن يُقرأ، أو أن يُعدّ لها ما ليس
 * للمستخدم — فتظهر لموظف لم يجرّب شيئًا لأن زميله جرّب.
 */

const CHAT = readFileSync(
  join(process.cwd(), 'src/components/dashboard/assistant/chat.tsx'),
  'utf8',
);
const SHELL = readFileSync(
  join(process.cwd(), 'src/app/(dashboard)/assistant/assistant-shell.tsx'),
  'utf8',
);
const CONFIG = readFileSync(join(process.cwd(), 'src/lib/config/feedback.ts'), 'utf8');
const ENV_EXAMPLE = readFileSync(join(process.cwd(), '.env.example'), 'utf8');

describe('العدّاد للمستخدم الحالي وحده', () => {
  it('يُعدّ عبر جلسة المستخدم (createClient) لا عميل الإدارة', () => {
    expect(SHELL).not.toContain('createAdminClient');
    expect(SHELL).toContain("from('messages')");
  });

  it('لا يُعدّ إلا إجابات المساعد الفعلية', () => {
    const block = SHELL.slice(SHELL.indexOf("from('messages')"));
    expect(block).toContain(".eq('role', 'ASSISTANT')");
    expect(block).toContain(".eq('answer_status', 'ANSWERED')");
  });

  it('العتبة خمس إجابات، وتُقرأ من الثابت لا من رقم مبعثر', () => {
    expect(CONFIG).toMatch(/FEEDBACK_SURVEY_MIN_ANSWERS = 5;/);
    expect(CHAT).toContain('answeredCount < FEEDBACK_SURVEY_MIN_ANSWERS');
  });
});

describe('تظهر مرّة وتُغلق فلا تعود', () => {
  it('الرفض يُحفظ ويُقرأ من المتصفح', () => {
    expect(CHAT).toContain("localStorage.setItem(FEEDBACK_SURVEY_DISMISSED_KEY, '1')");
    expect(CHAT).toContain('localStorage.getItem(FEEDBACK_SURVEY_DISMISSED_KEY)');
  });

  it('فتح الاستبيان يُعدّ رفضًا أيضًا — من فتحه لا يُسأل ثانية', () => {
    const link = CHAT.slice(CHAT.indexOf('href={FEEDBACK_SURVEY_URL}'));
    expect(link.slice(0, 300)).toContain('onClick={dismiss}');
  });

  it('تبدأ مخفيّة وتُقرَّر بعد التركيب — لا قفزة في الصفحة', () => {
    const nudge = CHAT.slice(CHAT.indexOf('function SurveyNudge'));
    expect(nudge).toContain('useState(false)');
    expect(nudge).toContain('useEffect(');
  });

  it('الرابط يُفتح في تبويب جديد بلا تسريب المُحيل', () => {
    expect(CHAT).toContain('rel="noopener noreferrer"');
  });
});

describe('الرابط من البيئة', () => {
  it('بلا رابط لا دعوة — والشرط في الشيفرة صريح', () => {
    expect(CHAT).toContain('if (!FEEDBACK_SURVEY_URL ||');
  });

  it('https فقط', () => {
    expect(CONFIG).toMatch(/\^https:\\\/\\\//);
  });

  it('المتغير موثّق في .env.example', () => {
    expect(ENV_EXAMPLE).toMatch(/^NEXT_PUBLIC_FEEDBACK_SURVEY_URL=/m);
  });
});
