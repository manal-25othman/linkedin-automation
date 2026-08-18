import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EarningsCalculator } from "@/components/affiliate/earnings-calculator";
import { getSettings } from "@/lib/settings";
import { formatBps } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "برنامج التسويق بالعمولة",
  description:
    "انضم لبرنامج أنجز للتسويق بالعمولة: رابط خاص وكود خصم، عمولة على كل طلب مدفوع، وسحب أرباحك على حسابك البنكي.",
};

export const revalidate = 600;

const faqs = [
  {
    q: "كيف تُحسب العمولة؟",
    a: "نسبة من قيمة الطلب المدفوعة بعد الخصم. تظهر لك في لوحتك فور دفع العميل، وتتحوّل إلى «معتمدة» بعد اكتمال الخدمة وانقضاء مدّة الضمان.",
  },
  {
    q: "ماذا لو استخدم العميل رابطي ثم عاد لاحقًا؟",
    a: "الكوكي يبقى محفوظًا طوال نافذة الإحالة، فأي طلب يُنشئه خلالها يُنسب لك حتى لو دخل الموقع مباشرة في المرة الأخيرة.",
  },
  {
    q: "ماذا لو اجتمع كود خصم مسوّق آخر مع رابطي؟",
    a: "الكود يفوز. كتابة العميل للكود فعل صريح ينسب البيع لصاحبه، وهذه القاعدة معلنة للجميع مسبقًا حتى لا يقع خلاف.",
  },
  {
    q: "متى أستلم أرباحي؟",
    a: "عند بلوغ رصيدك المعتمد الحدّ الأدنى تطلب السحب من لوحتك، ويُحوَّل المبلغ على الآيبان المسجّل باسمك.",
  },
  {
    q: "هل توجد شروط ممنوعة؟",
    a: "نعم: الرسائل المزعجة، والإعلانات باسم «أنجز» الرسمي، والوعود المبالغ فيها عن نتائج الخدمات، وشراء إعلانات على اسم المنصّة. المخالفة تُوقف الحساب وتُلغي العمولات المعلّقة.",
  },
];

export default async function AffiliateLandingPage() {
  const settings = await getSettings();
  const goldRate = settings.commission.defaultBps + settings.commission.tierBonusBps.GOLD;

  // متوسّط سعر الباقات المتاحة — أصدق من رقم تسويقي مكتوب يدويًا.
  const aggregate = await prisma.serviceTier
    .aggregate({ where: { isActive: true }, _avg: { price: true } })
    .catch(() => null);
  const averageOrder = Math.round(aggregate?._avg.price ?? 50_000);

  return (
    <>
      <section className="border-b border-line bg-surface">
        <div className="container-page grid gap-10 py-16 md:grid-cols-2">
          <div>
            <Badge tone="gold">دخل متكرّر بلا رأس مال</Badge>
            <h1 className="mt-5 font-display text-3xl font-extrabold leading-tight md:text-4xl">
              اربح من كل طلب يتم عبر رابطك
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-ink-soft">
              سجّل مجانًا، خذ رابطك وكود خصمك، وشاركهما مع من يحتاج خدماتنا.
              نحن ننفّذ الخدمة ونتابع العميل ونحصّل المبلغ — وأنت تأخذ نسبتك.
            </p>

            <ul className="mt-6 space-y-2 text-ink-soft">
              {[
                `عمولة أساسية ${formatBps(settings.commission.defaultBps)} وتصل إلى ${formatBps(goldRate)} بالترقية`,
                `نافذة إحالة ${settings.commission.attributionWindowDays} يومًا لكل نقرة`,
                `سحب الأرباح عند ${formatMoney(settings.commission.minPayout)}`,
                "لوحة تُظهر النقرات والطلبات والعمولة لحظة بلحظة",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-success">✓</span>
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/partner/register" size="lg">
                سجّل كمسوّق الآن
              </ButtonLink>
              <ButtonLink href="/partner/login" variant="secondary" size="lg">
                لدي حساب
              </ButtonLink>
            </div>
          </div>

          <EarningsCalculator
            averageOrder={averageOrder}
            rateBps={settings.commission.defaultBps}
            goldRateBps={goldRate}
          />
        </div>
      </section>

      <section className="container-page py-16">
        <h2 className="font-display text-2xl font-extrabold">المستويات والنِسَب</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {[
            {
              tier: "برونزي",
              rate: settings.commission.defaultBps,
              note: "من أول يوم، بلا شروط.",
              tone: "neutral" as const,
            },
            {
              tier: "فضّي",
              rate: settings.commission.defaultBps + settings.commission.tierBonusBps.SILVER,
              note: `بعد ${formatMoney(settings.commission.tierThresholds.silver)} مبيعات معتمدة.`,
              tone: "info" as const,
            },
            {
              tier: "ذهبي",
              rate: goldRate,
              note: `بعد ${formatMoney(settings.commission.tierThresholds.gold)} مبيعات معتمدة.`,
              tone: "gold" as const,
            },
          ].map((level) => (
            <div key={level.tier} className="card p-6">
              <Badge tone={level.tone}>{level.tier}</Badge>
              <p className="mt-4 font-display text-3xl font-extrabold text-brand tabular">
                {formatBps(level.rate)}
              </p>
              <p className="mt-2 text-sm text-ink-muted">{level.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-ink-muted">
          بعض الخدمات لها نسبة خاصة أعلى أو أقل حسب هامشها، وتظهر النسبة الفعلية بجانب كل
          خدمة داخل لوحتك.
        </p>
      </section>

      <section className="border-t border-line bg-surface py-16">
        <div className="container-page max-w-3xl">
          <h2 className="font-display text-2xl font-extrabold">أسئلة متكرّرة</h2>
          <div className="mt-6 space-y-3">
            {faqs.map((faq) => (
              <details key={faq.q} className="card group p-5">
                <summary className="cursor-pointer list-none font-semibold">
                  <span className="text-brand ltr:mr-2 rtl:ml-2 group-open:hidden">+</span>
                  <span className="hidden text-brand ltr:mr-2 rtl:ml-2 group-open:inline">−</span>
                  {faq.q}
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{faq.a}</p>
              </details>
            ))}
          </div>

          <div className="mt-10 text-center">
            <ButtonLink href="/partner/register" size="lg">
              ابدأ الآن — التسجيل مجاني
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
