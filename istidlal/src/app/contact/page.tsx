import type { Metadata } from "next";

import { PageShell } from "@/components/page-shell";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "تواصل معنا",
  description: "قنوات التواصل مع فريق استدلال: التصحيحات، التعاون، الإعلانات، والأسئلة التقنية.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <PageShell
      title="تواصل معنا"
      lead="بريد حقيقي يقرأه إنسان. لا روبوت ولا نموذج يذهب إلى المجهول."
      crumbs={[{ href: "/contact", label: "تواصل" }]}
    >
      <h2>القنوات</h2>
      <table>
        <thead>
          <tr>
            <th>الغرض</th>
            <th>العنوان</th>
            <th>زمن الردّ</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>استفسار عام أو اقتراح موضوع</td>
            <td>
              <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>
            </td>
            <td>٣ أيام عمل</td>
          </tr>
          <tr>
            <td>تصحيح خطأ في مقال</td>
            <td>
              <a href={`mailto:${siteConfig.editorialEmail}`}>{siteConfig.editorialEmail}</a>
            </td>
            <td>٤٨ ساعة</td>
          </tr>
          <tr>
            <td>الإعلان والرعاية</td>
            <td>
              <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>
            </td>
            <td>٥ أيام عمل</td>
          </tr>
        </tbody>
      </table>

      <h2>عند الإبلاغ عن خطأ</h2>
      <p>أرفق رابط المقال، والفقرة المقصودة، والمصدر الذي تستند إليه. هذا يختصر الطريق إلى التصحيح.</p>

      <h2>ما لا نستقبله</h2>
      <ul>
        <li>عروض شراء روابط أو نشر مقالات مدفوعة مموّهة كمحتوى تحريري.</li>
        <li>طلبات نشر بيانات صحفية تسويقية.</li>
        <li>محتوى مولّد آليًّا مقدَّمًا كمقال ضيف.</li>
      </ul>

      <h2>الشبكات</h2>
      <p>
        <a href={siteConfig.social.linkedin} rel="noopener noreferrer" target="_blank">
          لينكدإن
        </a>{" "}
        ·{" "}
        <a href={siteConfig.social.x} rel="noopener noreferrer" target="_blank">
          إكس
        </a>{" "}
        ·{" "}
        <a href={siteConfig.social.github} rel="noopener noreferrer" target="_blank">
          غيت هَب
        </a>
      </p>
    </PageShell>
  );
}
