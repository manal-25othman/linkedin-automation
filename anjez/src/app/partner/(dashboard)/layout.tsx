import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAffiliateUser } from "@/lib/auth/guard";
import { getAffiliateProfile } from "@/lib/queries/partner";
import { logout } from "@/app/actions/auth";
import { Badge, STATUS_TONES } from "@/components/ui/badge";
import { AFFILIATE_STATUS_LABELS, AFFILIATE_TIER_LABELS } from "@/lib/format";
import { siteConfig } from "@/config/site";
import { Logo } from "@/components/layout/logo";

const nav = [
  { href: "/partner", label: "اللوحة" },
  { href: "/partner/commissions", label: "العمولات" },
  { href: "/partner/payouts", label: "السحوبات" },
  { href: "/partner/settings", label: "الحساب" },
];

const STATUS_NOTES: Record<string, string> = {
  PENDING:
    "حسابك قيد المراجعة. نتحقّق من قنوات التسويق التي ذكرتها، ويصلك إشعار عند التفعيل — عادةً خلال يوم عمل.",
  SUSPENDED:
    "حسابك موقوف حاليًا. العمولات المعتمدة تبقى محفوظة، وللاستفسار تواصل معنا.",
  REJECTED: "لم يُقبل طلب الانضمام. يمكنك التواصل معنا لمعرفة السبب أو إعادة التقديم لاحقًا.",
};

export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAffiliateUser();
  const profile = await getAffiliateProfile(user.id);

  if (!profile) redirect("/partner/login");

  const isActive = profile.status === "ACTIVE";

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label={siteConfig.name}>
              <Logo />
            </Link>
            <Badge tone="brand">لوحة الشريك</Badge>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-muted sm:inline">{profile.user.name}</span>
            <Badge tone={STATUS_TONES[profile.tier] ?? "neutral"}>
              {AFFILIATE_TIER_LABELS[profile.tier]}
            </Badge>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-full border border-line-strong px-4 py-1.5 text-sm font-bold text-ink-soft hover:bg-surface-tint"
              >
                خروج
              </button>
            </form>
          </div>
        </div>

        {isActive ? (
          <nav className="container-page flex gap-1 overflow-x-auto border-t border-line py-2">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold text-ink-soft hover:bg-surface-tint hover:text-brand"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>

      <main className="container-page py-8">
        {isActive ? (
          children
        ) : (
          <div className="card mx-auto max-w-xl p-8 text-center">
            <Badge tone={STATUS_TONES[profile.status] ?? "warning"}>
              {AFFILIATE_STATUS_LABELS[profile.status]}
            </Badge>
            <h1 className="mt-4 font-display text-xl font-bold">حالة حسابك</h1>
            <p className="mt-3 leading-relaxed text-ink-muted">
              {STATUS_NOTES[profile.status] ?? ""}
            </p>
            <p className="mt-6 text-sm text-ink-faint">
              كودك المحجوز: <span className="font-mono font-bold text-ink">{profile.code}</span>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
