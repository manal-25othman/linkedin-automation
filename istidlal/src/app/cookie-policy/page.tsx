import type { Metadata } from "next";
import Link from "next/link";

import { PageShell } from "@/components/page-shell";

export const metadata: Metadata = {
  title: "سياسة ملفات الارتباط",
  description: "أنواع ملفات الارتباط المستخدمة في استدلال، وغرض كل نوع، وكيف تتحكّم فيها.",
  alternates: { canonical: "/cookie-policy" },
};

export default function CookiePolicyPage() {
  return (
    <PageShell
      title="سياسة ملفات الارتباط"
      lead="ملف الارتباط ملف نصي صغير يُحفظ في متصفّحك. هذه قائمة بما نستخدمه ولماذا."
      updated="2026-08-17"
      crumbs={[{ href: "/cookie-policy", label: "سياسة الكوكيز" }]}
    >
      <h2>الأنواع المستخدمة</h2>
      <table>
        <thead>
          <tr>
            <th>النوع</th>
            <th>المثال</th>
            <th>الغرض</th>
            <th>يحتاج موافقة؟</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>ضروري</td>
            <td>
              <code>istidlal-theme</code>
            </td>
            <td>حفظ تفضيلك للوضع الفاتح أو الداكن (تخزين محلي لا يغادر جهازك)</td>
            <td>لا</td>
          </tr>
          <tr>
            <td>تحليلي</td>
            <td>
              <code>_ga</code>، <code>_ga_*</code>
            </td>
            <td>قياس مجمّع لعدد الزيارات والصفحات الأكثر فائدة</td>
            <td>نعم</td>
          </tr>
          <tr>
            <td>إعلاني</td>
            <td>
              <code>__gads</code>، <code>IDE</code>
            </td>
            <td>عرض إعلانات Google وقياس أدائها ومنع تكرارها</td>
            <td>نعم</td>
          </tr>
        </tbody>
      </table>

      <h2>كيف تتحكّم</h2>
      <ul>
        <li>من لافتة الموافقة عند أول زيارة — يمكنك رفض غير الضروري.</li>
        <li>من إعدادات متصفّحك: حذف الملفات أو منعها كليًّا.</li>
        <li>
          من{" "}
          <a href="https://www.google.com/settings/ads" rel="noopener noreferrer" target="_blank">
            إعدادات إعلانات Google
          </a>{" "}
          لتعطيل تخصيص الإعلانات.
        </li>
      </ul>
      <p>
        منع الملفات التحليلية والإعلانية لا يعطّل قراءة المقالات. للمزيد راجع{" "}
        <Link href="/privacy-policy">سياسة الخصوصية</Link>.
      </p>
    </PageShell>
  );
}
