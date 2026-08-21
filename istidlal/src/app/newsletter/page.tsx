import type { Metadata } from "next";

import { NewsletterForm } from "@/components/newsletter-form";
import { PageShell } from "@/components/page-shell";

export const metadata: Metadata = {
  title: "النشرة البريدية",
  description: "نشرة استدلال الأسبوعية: ورقة مشروحة، قياس عملي، وخطأ شائع في الإنتاج.",
  alternates: { canonical: "/newsletter" },
};

export default function NewsletterPage() {
  return (
    <PageShell
      title="النشرة الأسبوعية"
      lead="إصدار واحد كل أسبوع، يُقرأ في خمس دقائق، ويمكن إلغاؤه برابط واحد."
      crumbs={[{ href: "/newsletter", label: "النشرة البريدية" }]}
    >
      <h2>ماذا يصلك</h2>
      <ul>
        <li>ورقة بحثية أو تحديث توثيق مهمّ، مشروحًا في فقرة واحدة وماذا يعني عمليًّا.</li>
        <li>قياس أو تجربة صغيرة أجريناها هذا الأسبوع بأرقامها.</li>
        <li>خطأ شائع رأيناه في نظام إنتاجي، وكيف يُتفادى.</li>
      </ul>

      <h2>ما لا يصلك</h2>
      <ul>
        <li>رسائل يومية، ولا إعادة تدوير للأخبار.</li>
        <li>رعايات مخفية — أي رعاية معنونة بوضوح.</li>
        <li>مشاركة بريدك مع أي جهة. نستخدمه للنشرة فقط.</li>
      </ul>

      <div className="not-prose mt-8">
        <NewsletterForm />
      </div>
    </PageShell>
  );
}
