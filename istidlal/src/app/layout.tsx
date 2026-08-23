import type { Metadata, Viewport } from "next";
import { Alexandria, Almarai, JetBrains_Mono } from "next/font/google";

import "./globals.css";

import { AnalyticsScripts } from "@/components/analytics-scripts";
import { CookieConsent } from "@/components/cookie-consent";
import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { absoluteUrl, configuredProfiles, siteConfig } from "@/config/site";
import { CONSENT_BOOTSTRAP } from "@/lib/consent";

// العناوين: هندسي حادّ الحواف. المتن: محايد مريح في القراءة الطويلة.
const alexandria = Alexandria({
  subsets: ["arabic", "latin"],
  weight: ["500", "600", "700"],
  variable: "--font-alexandria",
  display: "swap",
});

const almarai = Almarai({
  subsets: ["arabic"],
  weight: ["300", "400", "700"],
  variable: "--font-almarai",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — هندسة أنظمة الذكاء الاصطناعي التطبيقية`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  authors: [{ name: siteConfig.author.name, url: absoluteUrl("/about") }],
  creator: siteConfig.author.name,
  publisher: siteConfig.name,
  keywords: [
    "الذكاء الاصطناعي",
    "النماذج اللغوية",
    "RAG",
    "الاسترجاع المعزّز",
    "تقييم النماذج",
    "وكلاء الذكاء الاصطناعي",
    "هندسة الذكاء الاصطناعي",
    "أمن تطبيقات LLM",
  ],
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": [{ url: "/rss.xml", title: `${siteConfig.name} — RSS` }] },
  },
  openGraph: {
    type: "website",
    locale: "ar_AR",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${siteConfig.name} — هندسة أنظمة الذكاء الاصطناعي التطبيقية`,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — هندسة أنظمة الذكاء الاصطناعي التطبيقية`,
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  category: "technology",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

/** يضبط السمة قبل أول رسم لمنع وميض الوضع الفاتح على شاشة داكنة. */
const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem("istidlal-theme");if(t){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    alternateName: siteConfig.nameLatin,
    url: siteConfig.url,
    description: siteConfig.description,
    logo: absoluteUrl("/icon.svg"),
    // لا نُصرّح إلا بما هو مضبوط فعلًا: حقل فارغ أفضل من حقل كاذب.
    ...(siteConfig.email ? { email: siteConfig.email } : {}),
    ...(configuredProfiles().length ? { sameAs: configuredProfiles() } : {}),
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    inLanguage: "ar",
    publisher: { "@type": "Organization", name: siteConfig.name },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: absoluteUrl("/search?q={search_term_string}") },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${alexandria.variable} ${almarai.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        {/* وضع الموافقة يُضبط على الرفض قبل أي سكربت طرف ثالث. */}
        <script dangerouslySetInnerHTML={{ __html: CONSENT_BOOTSTRAP }} />
      </head>
      <body className="min-h-screen antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:right-3 focus:z-[60] focus:rounded-lg focus:bg-signal focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          تخطَّ إلى المحتوى
        </a>

        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />

        <JsonLd data={organization} />
        <JsonLd data={website} />

        <CookieConsent />
        <AnalyticsScripts />
      </body>
    </html>
  );
}
