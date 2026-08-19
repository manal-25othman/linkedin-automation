import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import { siteConfig } from "@/config/site";
import { getSiteUrl } from "@/lib/payments";

/**
 * خطّ واحد بأوزان متعدّدة: تجاول يغطّي العناوين والنصّ معًا، فيبقى الحرف
 * واحدًا في كل الصفحة، ويسقط طلب شبكة ثانٍ لخطّ عناوين منفصل.
 */
const bodyFont = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  formatDetection: { telephone: false, address: false, email: false },
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }] },
  openGraph: {
    type: "website",
    locale: "ar_SA",
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
};

export const viewport: Viewport = {
  themeColor: "#0e7c7b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={bodyFont.variable}>
      <body>{children}</body>
    </html>
  );
}
