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
        <li>
          من لافتة الموافقة عند أول زيارة — يمكنك قبول الكل، أو الاكتفاء بالضروري، أو التخصيص
          نوعًا نوعًا.
        </li>
        <li>
          في أي وقت لاحق: رابط <strong>«إدارة ملفات الارتباط»</strong> في تذييل كل صفحة يفتح
          اللوحة نفسها، فتغيّر قرارك أو تسحبه.
        </li>
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

      <h2>ماذا يحدث تقنيًّا قبل موافقتك</h2>
      <p>
        الحالة الافتراضية في هذا الموقع هي <strong>الرفض</strong>: يُضبط وضع الموافقة من Google
        (Consent Mode v2) على <code>denied</code> لكل من التخزين التحليلي والإعلاني قبل تحميل أي
        سكربت. ولا يُحقَن سكربت Google Analytics ولا سكربت AdSense في الصفحة أصلًا إلا بعد موافقة
        صريحة على نوعه — فلا يصدر عن الصفحة أي طلب إليهما قبل ذلك.
      </p>
      <p>
        قرارك يُحفظ في متصفّحك وحده (تخزين محلي باسم <code>istidlal-consent</code>) مع تاريخه،
        ولا يُرسل إلى خوادمنا.
      </p>
    </PageShell>
  );
}
