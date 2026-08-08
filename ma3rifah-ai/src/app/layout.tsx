import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

const APP_NAME = 'معرفة AI';
const APP_TAGLINE = 'حوّل معرفة شركتك إلى ذكاء يعمل معك.';
const APP_DESCRIPTION =
  'منصة ذكاء معرفي للشركات السعودية: حوّل سياساتك وإجراءاتك ومستنداتك إلى قاعدة معرفة ذكية يسأل عنها موظفوك ويحصلون على إجابات موثقة بالمصدر في ثوانٍ.';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ma3rifah.ai';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  keywords: [
    'ذكاء اصطناعي للشركات',
    'إدارة المعرفة',
    'قاعدة معرفة ذكية',
    'AI للشركات السعودية',
    'ذكاء اصطناعي للموظفين',
    'AI Knowledge Base',
    'مساعد ذكي للشركات',
    'أتمتة الموارد البشرية',
    'إدارة المستندات',
  ],
  authors: [{ name: APP_NAME }],
  creator: APP_NAME,
  publisher: APP_NAME,
  applicationName: APP_NAME,
  alternates: {
    canonical: '/',
    languages: { 'ar-SA': '/' },
  },
  openGraph: {
    type: 'website',
    locale: 'ar_SA',
    url: siteUrl,
    siteName: APP_NAME,
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description: APP_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0f766e',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/*
          القاعدة التالية تخص Pages Router؛ هنا الخط مُعرَّف في الجذر مرة
          واحدة فيُحمَّل لكل الصفحات، ولا يُستخدم next/font لتفادي جلب
          الخط وقت البناء في بيئات بلا وصول للشبكة.
        */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style
          // خط النظام كخط احتياطي حتى لو تعذّر تحميل الخط الخارجي
          dangerouslySetInnerHTML={{
            __html: `:root{--font-arabic:"IBM Plex Sans Arabic","Noto Sans Arabic","Segoe UI",system-ui,sans-serif}`,
          }}
        />
      </head>
      <body className="font-sans">
        {children}
        <Toaster
          position="top-center"
          dir="rtl"
          richColors
          toastOptions={{ style: { fontFamily: 'var(--font-arabic)' } }}
        />
      </body>
    </html>
  );
}
