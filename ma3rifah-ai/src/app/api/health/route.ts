import { NextResponse } from 'next/server';
import { checkConfiguration } from '@/lib/env';
import { getEmbeddingProvider } from '@/lib/rag/embeddings';
import { isAiConfigured } from '@/lib/ai/claude';

export const dynamic = 'force-dynamic';

/**
 * فحص جاهزية التشغيل.
 *
 * يكشف عن الإعدادات الناقصة دون كشف أي قيمة سرية — أسماء المتغيرات فقط.
 */
export async function GET() {
  const configuration = checkConfiguration();

  let embeddingsProvider = 'unknown';
  let embeddingsProduction = false;
  try {
    const provider = getEmbeddingProvider();
    embeddingsProvider = `${provider.name}/${provider.model}`;
    embeddingsProduction = provider.isProduction;
  } catch {
    embeddingsProvider = 'unavailable';
  }

  const body = {
    status: configuration.ok ? 'ok' : 'misconfigured',
    timestamp: new Date().toISOString(),
    checks: {
      supabase: configuration.missing.length === 0,
      claudeApi: isAiConfigured(),
      embeddings: { provider: embeddingsProvider, productionReady: embeddingsProduction },
    },
    missingEnvVars: configuration.missing,
    warnings: configuration.warnings,
  };

  return NextResponse.json(body, {
    status: configuration.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
