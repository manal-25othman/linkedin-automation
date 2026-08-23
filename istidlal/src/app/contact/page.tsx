import type { Metadata } from "next";

import { ContactForm } from "@/components/contact-form";
import { MarkdownPage, buildPageMetadata } from "@/components/markdown-page";
import { siteConfig } from "@/config/site";

export function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("contact");
}

/**
 * قناة تواصل عاملة شرطٌ في مراجعة أدسنس، ولذلك لا تعرض هذه الصفحة قناةً
 * غير مضبوطة: العنوان يظهر إن وُجد، والنموذج يظهر إن كان التسليم مفعّلًا،
 * وإن غاب الاثنان ظهرت الحقيقة بدل عنوان لا يصل إليه أحد.
 */
const formEnabled = Boolean(
  process.env.RESEND_API_KEY && process.env.CONTACT_TO_EMAIL && process.env.CONTACT_FROM_EMAIL,
);

export default function ContactPage() {
  const { email, editorialEmail, social } = siteConfig;
  const profiles = [
    { href: social.linkedin, label: "لينكدإن" },
    { href: social.x, label: "إكس" },
    { href: social.github, label: "غيت هَب" },
    { href: social.tiktok, label: "تيك توك" },
  ].filter((profile) => Boolean(profile.href));

  return (
    <MarkdownPage slug="contact">
      {formEnabled && (
        <>
          <h2>نموذج المراسلة</h2>
          <p>
            تصل الرسالة إلى بريد التحرير مباشرةً. إن كان الأمر تصحيحًا لخطأ في مقال، أرفق رابط
            المقال والفقرة — نراجع التصحيحات قبل غيرها.
          </p>
          <ContactForm enabled={formEnabled} />
        </>
      )}

      {(email || editorialEmail) && (
        <>
          <h2>عناوين البريد</h2>
          <ul>
            {email && (
              <li>
                عام وتعاون وإعلانات: <a href={`mailto:${email}`}>{email}</a>
              </li>
            )}
            {editorialEmail && (
              <li>
                تصحيح خطأ تحريري: <a href={`mailto:${editorialEmail}`}>{editorialEmail}</a>
              </li>
            )}
          </ul>
        </>
      )}

      {!formEnabled && !email && !editorialEmail && (
        <>
          <h2>قناة التواصل</h2>
          <p>
            قناة المراسلة قيد التجهيز ولم تُفعَّل بعد. لا نضع هنا عنوانًا لا تصل إليه رسالة: حين
            تُضبط القناة تظهر في هذا الموضع.
          </p>
        </>
      )}

      {profiles.length > 0 && (
        <>
          <h2>الشبكات</h2>
          <p>
            {profiles.map((profile, index) => (
              <span key={profile.href}>
                {index > 0 && " · "}
                <a href={profile.href} rel="noopener noreferrer" target="_blank">
                  {profile.label}
                </a>
              </span>
            ))}
          </p>
        </>
      )}
    </MarkdownPage>
  );
}
