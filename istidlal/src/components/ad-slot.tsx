import { siteConfig } from "@/config/site";

type AdSlotProps = {
  /** معرّف الوحدة الإعلانية من لوحة أدسنس. */
  slot?: string;
  /** ارتفاع محجوز مسبقًا — يمنع انهيار CLS عند تحميل الإعلان. */
  minHeight?: number;
  label?: string;
};

/**
 * مساحة إعلانية محجوزة الأبعاد. قبل ضبط `NEXT_PUBLIC_ADSENSE_CLIENT`
 * تُعرض كمساحة صامتة، فلا يظهر للزائر إطار فارغ ولا يُحمَّل سكربت.
 */
export function AdSlot({ slot, minHeight = 280, label = "مساحة إعلانية" }: AdSlotProps) {
  const client = siteConfig.adsense.client;

  if (!client || !slot) {
    return (
      <div
        aria-hidden="true"
        style={{ minHeight }}
        className="my-10 grid place-items-center rounded-2xl border border-dashed border-line text-xs text-ink-faint"
      >
        {label} — تُفعَّل بعد قبول أدسنس
      </div>
    );
  }

  return (
    <div className="my-10" style={{ minHeight }}>
      <p className="mb-1 text-[0.65rem] tracking-widest text-ink-faint">إعلان</p>
      <ins
        className="adsbygoogle block"
        style={{ display: "block", minHeight }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
