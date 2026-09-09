import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

const APP_NAME = 'بديهة';
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
    images: [{ url: '/og.png', width: 1200, height: 630, alt: APP_NAME }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description: APP_DESCRIPTION,
    images: ['/og.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#1E3967',
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
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <style
          /*
            خطّا الهوية المعتمدان: IBM Plex Sans Arabic للعربية وIBM Plex
            Sans للاتيني — وهما أسرة واحدة بمقاسين، فلا يُقرأ اجتماعهما
            تفكّكًا. الأوزان المعتمدة: ٦٠٠ للاسم والعناوين، ٥٠٠ للوصف،
            ٤٠٠ للنصوص.

            واللاتيني مذكور بعد العربي في السلسلة لا قبله: المتصفّح يأخذ
            أوّل خط يغطّي المحرف، فلو تقدّم اللاتيني لالتقط الأرقام
            والرموز المشتركة وانكسر اتّساق النصّ العربي.

            ويبقى الأحادي محصورًا في أسماء الجداول والأخطاء التقنية.
          */
          dangerouslySetInnerHTML={{
            __html:
              ':root{' +
              '--font-arabic:"IBM Plex Sans Arabic","IBM Plex Sans","Noto Sans Arabic","Segoe UI",system-ui,sans-serif;' +
              '--font-mono:"SFMono-Regular",Menlo,Consolas,monospace' +
              '}',
          }}
        />
      </head>
      <body className="font-sans">
        {/*
          يُعلِم CSS أن جافاسكربت متاح، فيُفعَّل الإخفاء الابتدائي لعناصر
          الظهور التدريجي. يعمل وقت التحليل قبل الرسم، فلا وميض.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
        {/*
          السمة تُحسم قبل الرسم لا بعده.
          حسمُها في React يعني أن الصفحة تُرسم بسمةٍ ثم تُصحَّح، فيرى
          الزائر ومضة بيضاء في وجهه — وهي أسوأ ما في الوضع الداكن.
          والاختيار المحفوظ يسبق تفضيل الجهاز، لأنه قرارٌ صريح.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{' +
              "var s=localStorage.getItem('theme');" +
              "var d=s?s==='dark':matchMedia('(prefers-color-scheme: dark)').matches;" +
              "document.documentElement.classList.toggle('dark',d);" +
              "document.documentElement.style.colorScheme=d?'dark':'light';" +
              '}catch(e){}})()',
          }}
        />
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
