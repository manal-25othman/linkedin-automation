import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { IBM_Plex_Sans_Arabic, JetBrains_Mono, Tajawal } from "next/font/google";

import "./globals.css";

import { JsonLd } from "@/components/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { absoluteUrl, siteConfig } from "@/config/site";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["500", "700"],
  variable: "--font-tajawal",
  display: "swap",
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-arabic",
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
    email: siteConfig.email,
    description: siteConfig.description,
    logo: absoluteUrl("/icon.svg"),
    sameAs: [siteConfig.social.linkedin, siteConfig.social.x, siteConfig.social.github],
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
      className={`${tajawal.variable} ${plexArabic.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
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

        {siteConfig.analytics.ga4 && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${siteConfig.analytics.ga4}`}
              strategy="afterInteractive"
            />
            <Script id="ga4" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${siteConfig.analytics.ga4}');`}
            </Script>
          </>
        )}

        {siteConfig.adsense.client && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${siteConfig.adsense.client}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  );
}
