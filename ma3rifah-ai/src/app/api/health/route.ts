import { NextResponse } from 'next/server';
import { checkConfiguration, serverEnv } from '@/lib/env';
import { getEmbeddingProvider } from '@/lib/rag/embeddings';
import { isAiConfigured } from '@/lib/ai/claude';
import { probeSupabase } from '@/lib/health/probe';

export const dynamic = 'force-dynamic';

/**
 * فحص جاهزية التشغيل.
 *
 * يكشف عن الإعدادات الناقصة دون كشف أي قيمة سرية — أسماء المتغيرات فقط.
 */
export async function GET() {
  const configuration = checkConfiguration();
  const supabase = await probeSupabase();

  let embeddingsProvider = 'unknown';
  let embeddingsProduction = false;
  try {
    const provider = getEmbeddingProvider();
    embeddingsProvider = `${provider.name}/${provider.model}`;
    embeddingsProduction = provider.isProduction;
  } catch {
    embeddingsProvider = 'unavailable';
  }

  // الإعدادات موجودة ≠ الإعدادات صحيحة. لا يُعدّ النظام جاهزًا حتى
  // ينجح المسبار الحيّ ضد Supabase فعلًا.
  const ready = configuration.ok && supabase.rest === 'ok' && supabase.auth === 'ok';

  const body = {
    status: ready ? 'ok' : 'misconfigured',
    timestamp: new Date().toISOString(),
    checks: {
      supabaseEnvVars: configuration.missing.length === 0,
      supabaseUrl: supabase.url,
      supabaseRest: supabase.rest,
      supabaseRestStatusCode: supabase.restStatusCode,
      supabaseAuth: supabase.auth,
      signupEnabled: supabase.signupEnabled,
      emailAutoconfirm: supabase.emailAutoconfirm,
      claudeApi: isAiConfigured(),
      embeddings: { provider: embeddingsProvider, productionReady: embeddingsProduction },
      /*
       * الدفع اختياريّ فلا يمنع الجاهزية — لكن غيابه كان لا يظهر هنا
       * إطلاقًا. فتُقرأ الصفحةُ خضراءَ كلّها ويُظنّ أن مسار الاشتراك
       * يعمل، ثم يتوقّف عند أول ضغطة بلا سبب ظاهر.
       *
       * و`webhookSecret` مذكورٌ وحده لأن غيابه عطلٌ صامت من نوع آخر:
       * الدفع ينجح لدى البوابة ولا يصل إشعاره، فيدفع العميل ولا
       * يُفعَّل اشتراكه.
       */
      payments: {
        configured: serverEnv.isPaymentsConfigured,
        webhookSecret: serverEnv.moyasarWebhookSecret !== '',
        mode: serverEnv.moyasarSecretKey.startsWith('sk_test')
          ? 'test'
          : serverEnv.isPaymentsConfigured
            ? 'live'
            : null,
      },
    },
    /*
     * أيّ نسخةٍ تعمل الآن.
     *
     * أُضيف بعد موقفٍ تكرّر: تُطبَّق ترحيلة في القاعدة ويبقى السؤال
     * «هل نُشرت الشيفرة التي تناديها؟» بلا جواب. فيُعاد التشخيص من
     * أوّله على فرضية خاطئة.
     *
     * والمعروض سبعة محارف من بصمة الالتزام لا أكثر: تكفي للمطابقة مع
     * سجلّ المستودع، ولا تكشف شيئًا عن البنية.
     */
    version: {
      commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7),
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      environment: process.env.VERCEL_ENV ?? 'development',
    },
    missingEnvVars: configuration.missing,
    // أسماء المتغيرات المقروءة فعلًا وقت التشغيل — بلا أي قيمة. يكشف
    // أخطاء التسمية (مثل حفظ المفتاح باسم غير الذي يقرأه الكود).
    detectedEnvVars: configuration.detected,
    warnings: configuration.warnings,
  };

  return NextResponse.json(body, {
    status: ready ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
