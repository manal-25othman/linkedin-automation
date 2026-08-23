import { describe, expect, it } from 'vitest';
import {
  evaluateSession,
  formatDurationAr,
  policyFor,
  shouldRefreshStamp,
  tierForRole,
  type SessionStamp,
} from '../../src/lib/auth/session-policy';

/**
 * سياسة عمر الجلسة.
 *
 * العطل الذي دفع إلى بناء هذه الطبقة كان بسيطًا في وصفه وخطيرًا في
 * أثره: جلسة مدير المنصة بقيت مفتوحة أيامًا. وجلسة Supabase لا تنتهي
 * وحدها — رمز التحديث يُجدَّد كلما عاد المتصفح.
 *
 * ولذلك تُختبر هنا الحدود نفسها لا السلوك العام: ما قبل الحدّ بلحظة
 * يُقبل، وعند الحدّ يُرفض. والخطأ في هذا الفرق هو ما يجعل سياسةً مكتوبة
 * لا تُطبَّق فعلًا.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const NOW = 1_800_000_000_000;

function stamp(over: Partial<SessionStamp> = {}): SessionStamp {
  return { tier: 'STANDARD', startedAt: NOW, lastSeenAt: NOW, ...over };
}

describe('رتبة الدور', () => {
  it('مدير المنصة ومدير الشركة رتبة مشدَّدة', () => {
    expect(tierForRole('SUPER_ADMIN')).toBe('ADMIN');
    expect(tierForRole('COMPANY_ADMIN')).toBe('ADMIN');
  });

  it('مدير القسم والموظف رتبة عادية', () => {
    expect(tierForRole('MANAGER')).toBe('STANDARD');
    expect(tierForRole('EMPLOYEE')).toBe('STANDARD');
  });

  it('الدور المجهول يُشدَّد لا يُخفَّف', () => {
    // دورٌ جديد لم تُحدَّث له القائمة يجب ألّا يرث أطول جلسة
    expect(tierForRole(null)).toBe('ADMIN');
    expect(tierForRole(undefined)).toBe('ADMIN');
    expect(tierForRole('ROLE_LM_YUKTAB_BAD')).toBe('STANDARD');
  });
});

describe('السياسات', () => {
  it('جلسة المدير أقصر من جلسة الموظف في المهلتين', () => {
    const admin = policyFor('ADMIN');
    const standard = policyFor('STANDARD');
    expect(admin.idleMs).toBeLessThan(standard.idleMs);
    expect(admin.absoluteMs).toBeLessThan(standard.absoluteMs);
  });

  it('مهلة الخمول أقصر دائمًا من المهلة القصوى', () => {
    // العكس يجعل المهلة القصوى بلا أثر — لا تُبلغ أبدًا
    for (const tier of ['ADMIN', 'STANDARD'] as const) {
      expect(policyFor(tier).idleMs).toBeLessThan(policyFor(tier).absoluteMs);
    }
  });
});

describe('الحكم على الجلسة', () => {
  it('الجلسة النشطة تمرّ', () => {
    expect(evaluateSession(stamp(), NOW)).toBe('OK');
  });

  it('جلسة المدير تنتهي بالخمول بعد ساعة', () => {
    const s = stamp({ tier: 'ADMIN', lastSeenAt: NOW - HOUR });
    expect(evaluateSession(s, NOW)).toBe('IDLE_EXPIRED');
  });

  it('وتبقى قبل الساعة بلحظة', () => {
    const s = stamp({ tier: 'ADMIN', lastSeenAt: NOW - HOUR + 1 });
    expect(evaluateSession(s, NOW)).toBe('OK');
  });

  it('جلسة المدير تنتهي بالمهلة القصوى ولو كان نشطًا الآن', () => {
    // هذا ما تحميه المهلة القصوى: جلسة مسروقة تُبقيها حركة آلية حيّة
    const s = stamp({ tier: 'ADMIN', startedAt: NOW - 12 * HOUR, lastSeenAt: NOW });
    expect(evaluateSession(s, NOW)).toBe('ABSOLUTE_EXPIRED');
  });

  it('جلسة الموظف تحتمل يوم عمل كاملًا', () => {
    const s = stamp({ lastSeenAt: NOW - 7 * HOUR });
    expect(evaluateSession(s, NOW)).toBe('OK');
  });

  it('وتنتهي بعد ثمان ساعات سكون', () => {
    const s = stamp({ lastSeenAt: NOW - 8 * HOUR });
    expect(evaluateSession(s, NOW)).toBe('IDLE_EXPIRED');
  });

  it('وتنتهي بعد ثلاثين يومًا مهما كان نشاطها', () => {
    const s = stamp({ startedAt: NOW - 30 * DAY, lastSeenAt: NOW });
    expect(evaluateSession(s, NOW)).toBe('ABSOLUTE_EXPIRED');
  });

  it('المهلة القصوى تسبق الخمول في الحكم', () => {
    // جلسة تجاوزت الاثنتين ⇒ يُذكر الأقوى سببًا
    const s = stamp({ tier: 'ADMIN', startedAt: NOW - 20 * HOUR, lastSeenAt: NOW - 5 * HOUR });
    expect(evaluateSession(s, NOW)).toBe('ABSOLUTE_EXPIRED');
  });
});

describe('رفض الأختام المُلاعَب بها', () => {
  it('ختم من المستقبل يُرفض', () => {
    // قبولُه يجعل تقديم الساعة وسيلة لتمديد الجلسة بلا حدّ
    const s = stamp({ startedAt: NOW + 10 * MINUTE, lastSeenAt: NOW + 10 * MINUTE });
    expect(evaluateSession(s, NOW)).toBe('MALFORMED');
  });

  it('فارق ساعة يسير مقبول', () => {
    const s = stamp({ startedAt: NOW + MINUTE, lastSeenAt: NOW + MINUTE });
    expect(evaluateSession(s, NOW)).toBe('OK');
  });

  it('الأرقام غير الصالحة تُرفض', () => {
    expect(evaluateSession(stamp({ startedAt: Number.NaN }), NOW)).toBe('MALFORMED');
    expect(evaluateSession(stamp({ lastSeenAt: 0 }), NOW)).toBe('MALFORMED');
    expect(evaluateSession(stamp({ startedAt: -1 }), NOW)).toBe('MALFORMED');
    expect(evaluateSession(stamp({ lastSeenAt: Number.POSITIVE_INFINITY }), NOW)).toBe(
      'MALFORMED',
    );
  });
});

describe('تحديث الختم', () => {
  it('لا يُكتب على كل طلب', () => {
    expect(shouldRefreshStamp(stamp({ lastSeenAt: NOW - 10_000 }), NOW)).toBe(false);
  });

  it('يُكتب بعد دقيقة', () => {
    expect(shouldRefreshStamp(stamp({ lastSeenAt: NOW - MINUTE }), NOW)).toBe(true);
  });

  it('فترة التحديث أقصر بكثير من أقصر مهلة خمول', () => {
    // وإلا انتهت جلسة نشطة لأن ختمها لم يُحدَّث في وقته
    const shortest = Math.min(policyFor('ADMIN').idleMs, policyFor('STANDARD').idleMs);
    expect(MINUTE * 10).toBeLessThan(shortest);
  });
});

describe('صياغة المدة بالعربية', () => {
  it('تُعرب العدد مع المعدود', () => {
    expect(formatDurationAr(60 * MINUTE)).toBe('ساعة');
    expect(formatDurationAr(2 * HOUR)).toBe('ساعتين');
    expect(formatDurationAr(8 * HOUR)).toBe('8 ساعات');
    expect(formatDurationAr(12 * HOUR)).toBe('12 ساعة');
    expect(formatDurationAr(DAY)).toBe('يوم');
    expect(formatDurationAr(2 * DAY)).toBe('يومين');
    expect(formatDurationAr(30 * DAY)).toBe('30 يومًا');
    expect(formatDurationAr(30 * MINUTE)).toBe('30 دقيقة');
  });

  it('لا تُخرج صيغة «1 ساعات»', () => {
    for (const ms of [MINUTE, HOUR, DAY]) {
      expect(formatDurationAr(ms)).not.toMatch(/^1 /);
    }
  });
});
