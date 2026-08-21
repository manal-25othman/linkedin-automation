"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

import { readConsent, type ConsentState } from "@/lib/consent";
import { siteConfig } from "@/config/site";

/**
 * لا يُحمَّل سكربت تحليلي أو إعلاني إلا بعد موافقة صريحة على نوعه.
 * قبل ذلك لا يصدر عن الصفحة أي طلب إلى Google — وهو الفرق بين لافتة
 * شكلية ولافتة تفعل ما تقوله.
 */
export function AnalyticsScripts() {
  const [consent, setConsent] = useState<ConsentState | null>(null);

  useEffect(() => {
    setConsent(readConsent());
    const onChange = (event: Event) => setConsent((event as CustomEvent<ConsentState>).detail);
    window.addEventListener("istidlal:consent-changed", onChange);
    return () => window.removeEventListener("istidlal:consent-changed", onChange);
  }, []);

  const ga4 = siteConfig.analytics.ga4;
  const adsense = siteConfig.adsense.client;

  return (
    <>
      {ga4 && consent?.analytics && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4}',{anonymize_ip:true});`}
          </Script>
        </>
      )}

      {adsense && consent?.ads && (
        <Script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsense}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      )}
    </>
  );
}
