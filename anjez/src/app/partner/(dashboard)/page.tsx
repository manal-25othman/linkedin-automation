import Link from "next/link";
import type { Metadata } from "next";
import { requireAffiliateUser } from "@/lib/auth/guard";
import {
  getAffiliateCoupons,
  getAffiliateProfile,
  getAffiliateStats,
  syncAffiliateTier,
} from "@/lib/queries/partner";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { nextTierGap, resolveRateBps } from "@/lib/affiliate/commission";
import { formatMoney } from "@/lib/money";
import { formatBps, formatNumber, AFFILIATE_TIER_LABELS } from "@/lib/format";
import { Stat } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { LinkGenerator } from "@/components/affiliate/link-generator";

export const metadata: Metadata = { title: "لوحة الشريك", robots: { index: false } };

export default async function PartnerDashboard() {
  const user = await requireAffiliateUser();
  const profile = await getAffiliateProfile(user.id);
  if (!profile) return null;

  const [{ approvedSales, tier }, stats, settings, services, coupons] = await Promise.all([
    syncAffiliateTier(profile.id, profile.tier),
    getAffiliateStats(profile.id),
    getSettings(),
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: { title: "asc" },
      select: { slug: true, title: true },
    }),
    getAffiliateCoupons(profile.id),
  ]);

  const rate = resolveRateBps({
    affiliateCustomBps: profile.customBps,
    tier,
    settings: settings.commission,
  });

  const gap = nextTierGap(approvedSales, settings.commission);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-extrabold">أهلًا {profile.user.name}</h1>
        <p className="mt-1 text-ink-muted">
          كودك <span className="font-mono font-bold text-ink">{profile.code}</span> — نسبتك الحالية{" "}
          <span className="font-bold text-brand">{formatBps(rate)}</span> على الخدمات بلا نسبة خاصة.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="النقرات" value={formatNumber(stats.clicks)} />
        <Stat
          label="الطلبات المدفوعة"
          value={formatNumber(stats.paidOrders)}
          hint={`نسبة التحويل ${stats.conversionRate}٪`}
          tone="brand"
        />
        <Stat
          label="رصيد معتمد قابل للسحب"
          value={formatMoney(stats.balances.available)}
          tone="success"
        />
        <Stat
          label="عمولات معلّقة"
          value={formatMoney(stats.balances.pending)}
          hint={`تُعتمد بعد ${settings.commission.holdDays} يومًا من اكتمال الطلب`}
          tone="muted"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <LinkGenerator code={profile.code} services={services} />

        <div className="space-y-6">
          <div className="card p-6">
            <p className="font-display text-lg font-bold">مستواك</p>
            <div className="mt-3 flex items-center gap-3">
              <Badge tone={tier === "GOLD" ? "accent" : tier === "SILVER" ? "info" : "neutral"}>
                {AFFILIATE_TIER_LABELS[tier]}
              </Badge>
              <span className="text-sm text-ink-muted">
                مبيعات معتمدة: {formatMoney(approvedSales)}
              </span>
            </div>

            {gap ? (
              <p className="mt-4 text-sm text-ink-soft">
                يتبقّى {formatMoney(gap.remaining)} من المبيعات المعتمدة للترقية إلى{" "}
                <span className="font-semibold">{AFFILIATE_TIER_LABELS[gap.tier]}</span>.
              </p>
            ) : (
              <p className="mt-4 text-sm text-success">وصلت إلى أعلى مستوى — نسبتك القصوى مفعّلة.</p>
            )}
          </div>

          <div className="card p-6">
            <p className="font-display text-lg font-bold">أكواد الخصم الخاصة بك</p>
            {coupons.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">
                لا يوجد كود مخصّص لك بعد. اطلب من الإدارة كودًا يمنح متابعيك خصمًا ويُنسب البيع
                لك حتى دون رابط.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {coupons.map((coupon) => (
                  <li
                    key={coupon.code}
                    className="flex items-center justify-between rounded-lg bg-surface-soft px-3 py-2 text-sm"
                  >
                    <span className="font-mono font-bold">{coupon.code}</span>
                    <span className="text-ink-muted">
                      {coupon.type === "PERCENT"
                        ? `${coupon.value / 100}٪`
                        : formatMoney(coupon.value)}{" "}
                      · استُخدم {formatNumber(coupon.usedCount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="card p-6">
        <p className="font-display text-lg font-bold">كيف تزيد أرباحك</p>
        <ul className="mt-3 space-y-2 text-sm text-ink-soft">
          <li>• وجّه رابطك إلى صفحة الخدمة المحدّدة لا إلى الرئيسية — التحويل أعلى بكثير.</li>
          <li>• اكتب تجربتك مع الخدمة بدل نسخ الوصف التسويقي.</li>
          <li>
            • تابع{" "}
            <Link href="/partner/commissions" className="text-brand hover:underline">
              صفحة العمولات
            </Link>{" "}
            لتعرف أي خدمة تُحوّل فعلًا وركّز عليها.
          </li>
        </ul>
      </div>
    </div>
  );
}
