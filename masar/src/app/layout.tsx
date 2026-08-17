import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

const APP_NAME = 'مسار';
const APP_TAGLINE = 'من رابط الوظيفة إلى سيرة تُقنع.';
const APP_DESCRIPTION =
  'وكيل ذكي يقرأ إعلان الوظيفة، يعطيك نصائح التقديم والملخص المهني الجاهز، ثم يحلّل سيرتك الذاتية ويعيد كتابتها لتطابق الوظيفة — مع مقارنة قبل/بعد ورسالة تقديم وملف Word جاهز.';

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  keywords: [
    'تحليل السيرة الذاتية',
    'تحسين السيرة الذاتية',
    'كتابة سيرة ذاتية',
    'ATS',
    'رسالة تقديم',
    'نصائح التقديم على الوظائف',
    'لينكدإن',
  ],
  applicationName: APP_NAME,
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#4338ca',
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
          الخط يُحمَّل برابط مباشر لا بـ next/font: هذا الأخير يجلب الخط وقت
          البناء، فينكسر البناء في بيئة بلا وصول للشبكة.
        */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap"
          rel="stylesheet"
        />
        <style
          dangerouslySetInnerHTML={{
            __html:
              ':root{' +
              '--font-arabic:"Tajawal","Noto Sans Arabic","Segoe UI",system-ui,sans-serif;' +
              '--font-mono:"SFMono-Regular",Menlo,Consolas,monospace' +
              '}',
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
