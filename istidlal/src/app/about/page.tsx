import type { Metadata } from "next";

import { JsonLd } from "@/components/json-ld";
import { MarkdownPage, buildPageMetadata } from "@/components/markdown-page";
import { absoluteUrl, configuredProfiles, siteConfig } from "@/config/site";

export function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("about");
}

export default function AboutPage() {
  const person = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: siteConfig.author.name,
    jobTitle: siteConfig.author.role,
    description: siteConfig.author.bio,
    url: absoluteUrl("/about"),
    // حقل فارغ في البيانات المهيكلة أسوأ من غيابه — لا نُصرّح ببريد غير مضبوط.
    ...(siteConfig.email ? { email: siteConfig.email } : {}),
    ...(configuredProfiles().length ? { sameAs: configuredProfiles() } : {}),
    worksFor: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
  };

  return (
    <>
      <MarkdownPage slug="about">
        <h2>من يكتب</h2>
        <p>
          <strong>{siteConfig.author.name}</strong> — {siteConfig.author.role}. {siteConfig.author.bio}
        </p>
      </MarkdownPage>
      <JsonLd data={person} />
    </>
  );
}
