import { describe, expect, it } from 'vitest';
import {
  daysUntil,
  describeSubscription,
  formatDaysAr,
  type SubscriptionRecord,
} from '../../src/lib/billing/subscription-state';

/**
 * حالة الاشتراك.
 *
 * أخطر ما يُختبر هنا **متى تُحجب الخدمة**: الحجب في غير موضعه يوقف عمل
 * عميل يدفع، وتركُه في موضعه يعطي الخدمة مجانًا. وكلاهما خطأ مكلف،
 * والفرق بينهما شرطٌ واحد.
 *
 * وثانيه **الصمت قبل الانتهاء**: تجربةٌ تنتهي بلا تنبيه تُوقف العمل
 * فجأة، فيظنّ العميل المنصةَ معطّلة لا اشتراكَه منتهيًا.
 */

const NOW = Date.parse('2026-06-15T12:00:00Z');

function inDays(days: number): string {
  return new Date(NOW + days * 86_400_000).toISOString();
}

function sub(over: Partial<SubscriptionRecord> = {}): SubscriptionRecord {
  return {
    status: 'ACTIVE',
    currentPeriodEnd: inDays(20),
    trialEndsAt: null,
    canceledAt: null,
    ...over,
  };
}

describe('حساب الأيام', () => {
  it('يعدّ اليوم الجاري يومًا كاملًا', () => {
    // من بقي له ساعتان في «يومه الأخير» لا «صفر أيام»
    expect(daysUntil(new Date(NOW + 2 * 3_600_000).toISOString(), NOW)).toBe(1);
  });

  it('يعطي صفرًا أو أقل بعد الموعد', () => {
    expect(daysUntil(inDays(-1), NOW)).toBeLessThanOrEqual(0);
  });

  it('يتحمّل التاريخ الغائب والتالف', () => {
    expect(daysUntil(null, NOW)).toBeNull();
    expect(daysUntil('ليس تاريخًا', NOW)).toBeNull();
  });
});

describe('صياغة الأيام بالعربية', () => {
  it('تُعرب العدد مع المعدود', () => {
    expect(formatDaysAr(1)).toBe('يوم واحد');
    expect(formatDaysAr(2)).toBe('يومان');
    expect(formatDaysAr(5)).toBe('5 أيام');
    expect(formatDaysAr(14)).toBe('14 يومًا');
    expect(formatDaysAr(0)).toBe('اليوم');
  });
});

describe('التجربة المجانية', () => {
  it('تجربة بعيدة الانتهاء لا تُظهر شريطًا', () => {
    const view = describeSubscription(
      sub({ status: 'TRIALING', trialEndsAt: inDays(11) }),
      NOW,
    );
    expect(view.isTrial).toBe(true);
    expect(view.isBlocked).toBe(false);
    expect(view.showBanner).toBe(false);
    expect(view.daysLeft).toBe(11);
    expect(view.detail).toContain('11 يومًا');
  });

  it('تصير عاجلة قبل الانتهاء بثلاثة أيام', () => {
    const view = describeSubscription(
      sub({ status: 'TRIALING', trialEndsAt: inDays(3) }),
      NOW,
    );
    expect(view.tone).toBe('warning');
    expect(view.showBanner).toBe(true);
    expect(view.isBlocked).toBe(false);
  });

  it('تنتهي فتُحجب الخدمة ولا تُحذف البيانات', () => {
    const view = describeSubscription(
      sub({ status: 'TRIALING', trialEndsAt: inDays(-1) }),
      NOW,
    );
    expect(view.status).toBe('EXPIRED');
    expect(view.isBlocked).toBe(true);
    expect(view.detail).toContain('محفوظة');
  });

  it('انتهاء المدة يسبق تحديث الحالة في قاعدة البيانات', () => {
    // الحالة ما زالت TRIALING لكن التاريخ مضى. والاعتماد على تحديث
    // الحالة وحده يمنح أيامًا مجانية لمن تأخّرت عنه المهمة المجدولة.
    const view = describeSubscription(
      sub({ status: 'TRIALING', trialEndsAt: inDays(-5) }),
      NOW,
    );
    expect(view.isBlocked).toBe(true);
  });

  it('تُقاس بنهاية التجربة لا بنهاية الدورة حين تختلفان', () => {
    const view = describeSubscription(
      sub({ status: 'TRIALING', trialEndsAt: inDays(2), currentPeriodEnd: inDays(30) }),
      NOW,
    );
    expect(view.daysLeft).toBe(2);
  });

  it('وتقع على نهاية الدورة إن غابت نهاية التجربة', () => {
    const view = describeSubscription(
      sub({ status: 'TRIALING', trialEndsAt: null, currentPeriodEnd: inDays(7) }),
      NOW,
    );
    expect(view.daysLeft).toBe(7);
  });
});

describe('الاشتراك النشط', () => {
  it('لا يُحجب ولا يُظهر شريطًا', () => {
    const view = describeSubscription(sub(), NOW);
    expect(view.isBlocked).toBe(false);
    expect(view.showBanner).toBe(false);
    expect(view.tone).toBe('neutral');
    expect(view.cta).toBeNull();
  });

  it('يذكر موعد التجديد', () => {
    expect(describeSubscription(sub({ currentPeriodEnd: inDays(9) }), NOW).detail).toContain(
      '9 أيام',
    );
  });

  it('المُلغى يبقى عاملًا حتى نهاية دورته', () => {
    // الإلغاء لا يقطع خدمةً دُفع ثمنها
    const view = describeSubscription(
      sub({ canceledAt: inDays(-2), currentPeriodEnd: inDays(12) }),
      NOW,
    );
    expect(view.isBlocked).toBe(false);
    expect(view.label).toContain('مُلغى');
    expect(view.cta?.label).toContain('إعادة تفعيل');
  });

  it('والمُلغى قرب نهايته يُظهر شريطًا', () => {
    const view = describeSubscription(
      sub({ canceledAt: inDays(-20), currentPeriodEnd: inDays(2) }),
      NOW,
    );
    expect(view.showBanner).toBe(true);
  });
});

describe('تعذّر الدفع', () => {
  it('يُنبَّه ولا يُحجب فورًا', () => {
    // الدفع يفشل لسبب عابر، وقطعُ الخدمة عند أول فشل يعاقب عميلًا يدفع
    const view = describeSubscription(sub({ status: 'PAST_DUE' }), NOW);
    expect(view.showBanner).toBe(true);
    expect(view.tone).toBe('danger');
    expect(view.isBlocked).toBe(false);
    expect(view.cta?.href).toBe('/settings/billing');
  });
});

describe('الملغى والمنتهي', () => {
  it('كلاهما يُحجب ويُطمئن على البيانات', () => {
    for (const status of ['CANCELED', 'EXPIRED'] as const) {
      const view = describeSubscription(sub({ status }), NOW);
      expect(view.isBlocked, status).toBe(true);
      expect(view.showBanner, status).toBe(true);
      expect(view.detail, status).toContain('محفوظة');
      expect(view.cta, status).not.toBeNull();
    }
  });
});

describe('غياب الاشتراك', () => {
  it('يُعرض صراحةً لا يُترك شاشةً بيضاء', () => {
    const view = describeSubscription(null, NOW);
    expect(view.isBlocked).toBe(true);
    expect(view.cta?.href).toBe('/support');
  });
});

describe('سلامة عامة', () => {
  it('كل حالة تعطي تسمية وشرحًا غير فارغين', () => {
    const statuses = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED'] as const;
    for (const status of statuses) {
      for (const days of [-5, 0, 2, 30]) {
        const view = describeSubscription(
          sub({ status, currentPeriodEnd: inDays(days), trialEndsAt: inDays(days) }),
          NOW,
        );
        expect(view.label.trim(), status).not.toBe('');
        expect(view.detail.trim(), status).not.toBe('');
        // المحجوب لا بدّ له من نداء فعل — وإلا وقف المستخدم بلا مخرج
        if (view.isBlocked) expect(view.cta, `${status}/${days}`).not.toBeNull();
      }
    }
  });

  it('كل نداء فعل يشير إلى مسار داخلي', () => {
    const statuses = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED'] as const;
    for (const status of statuses) {
      const view = describeSubscription(sub({ status, canceledAt: inDays(-1) }), NOW);
      if (view.cta) expect(view.cta.href.startsWith('/')).toBe(true);
    }
  });
});
