import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * دعوة الاستبيان داخل المساعد.
 *
 * تظهر بعد خمس إجابات فعلية للمستخدم نفسه، وتُغلق فلا تعود، ولا تظهر
 * لمن أرسل الاستبيان. والخطر فيها: أن تصير إزعاجًا يُغلق قبل أن يُقرأ،
 * أو أن يُعدّ لها ما ليس للمستخدم — فتظهر لموظف لم يجرّب شيئًا لأن
 * زميله جرّب.
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
const MIGRATION = readFileSync(
  join(process.cwd(), 'supabase/migrations/0037_feedback_survey.sql'),
  'utf8',
);
const ACTION = readFileSync(join(process.cwd(), 'src/app/(dashboard)/feedback/actions.ts'), 'utf8');

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

  it('من أرسل الاستبيان لا يُدعى إليه ثانية', () => {
    expect(SHELL).toContain("from('feedback_surveys')");
    expect(CHAT).toContain('if (surveyDone || answeredCount < FEEDBACK_SURVEY_MIN_ANSWERS) return;');
  });

  it('فتح الاستبيان يُعدّ رفضًا أيضًا — من فتحه لا يُسأل ثانية', () => {
    const link = CHAT.slice(CHAT.indexOf('href={FEEDBACK_SURVEY_PATH}'));
    expect(link.slice(0, 200)).toContain('onClick={dismiss}');
  });

  it('تبدأ مخفيّة وتُقرَّر بعد التركيب — لا قفزة في الصفحة', () => {
    const nudge = CHAT.slice(CHAT.indexOf('function SurveyNudge'));
    expect(nudge).toContain('useState(false)');
    expect(nudge).toContain('useEffect(');
  });
});

describe('الاستبيان داخل المنصة لا رابطًا خارجيًا', () => {
  it('الدعوة تفتح صفحة داخلية', () => {
    expect(CONFIG).toContain("FEEDBACK_SURVEY_PATH = '/feedback'");
    expect(CHAT).not.toContain('target="_blank"');
    expect(ENV_EXAMPLE).not.toContain('FEEDBACK_SURVEY_URL');
  });

  it('لا يُطلب اسم ولا بريد — الهوية من الجلسة، والسياسة تتحقق منها', () => {
    expect(ACTION).not.toMatch(/formData\.get\('(email|fullName|name|company)'\)/);
    expect(ACTION).toContain('user_id: profile.id');
    expect(MIGRATION).toContain('with check (user_id = auth.uid() and company_id = public.current_company_id())');
  });

  it('إجابة واحدة لكل مستخدم تُعدَّل لا تُكرَّر', () => {
    expect(MIGRATION).toContain('unique (user_id)');
    expect(ACTION).toContain("{ onConflict: 'user_id' }");
  });

  it('يقرأ المستخدم إجابته هو، ومالك المنصة الكل، ولا أحد غيرهما', () => {
    expect(MIGRATION).toContain('using (user_id = auth.uid() or public.is_super_admin())');
  });
});
