import { NewsletterForm } from "./newsletter-form";
import { isNewsletterEnabled } from "@/lib/newsletter";

export function NewsletterCta() {
  return (
    <section className="rounded-2xl border border-line bg-surface p-7 md:p-9">
      <div className="grid gap-6 md:grid-cols-[1.2fr_1fr] md:items-center">
        <div>
          <h2 className="font-display text-xl font-bold text-ink">نشرة استدلال الأسبوعية</h2>
          <p className="mt-2 text-sm leading-7 text-ink-muted">
            ثلاثة أشياء مفيدة كل أسبوع: ورقة بحثية مشروحة، قياس عملي، وخطأ شائع رأيناه في الإنتاج.
            بلا حشو وبلا رعايات مخفية.
          </p>
        </div>
        <NewsletterForm enabled={isNewsletterEnabled()} />
      </div>
    </section>
  );
}
