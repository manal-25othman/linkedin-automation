import { NextResponse } from 'next/server';
import { checkConfiguration } from '@/lib/env';
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
      supabaseRest: supabase.rest,
      supabaseAuth: supabase.auth,
      signupEnabled: supabase.signupEnabled,
      emailAutoconfirm: supabase.emailAutoconfirm,
      claudeApi: isAiConfigured(),
      embeddings: { provider: embeddingsProvider, productionReady: embeddingsProduction },
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
