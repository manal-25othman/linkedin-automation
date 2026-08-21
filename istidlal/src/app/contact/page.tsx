import type { Metadata } from "next";

import { MarkdownPage, buildPageMetadata } from "@/components/markdown-page";
import { siteConfig } from "@/config/site";

export function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("contact");
}

export default function ContactPage() {
  return (
    <MarkdownPage slug="contact">
      <h2>عناوين البريد</h2>
      <ul>
        <li>
          عام وتعاون وإعلانات: <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>
        </li>
        <li>
          تصحيح خطأ تحريري:{" "}
          <a href={`mailto:${siteConfig.editorialEmail}`}>{siteConfig.editorialEmail}</a>
        </li>
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
    </MarkdownPage>
  );
}
