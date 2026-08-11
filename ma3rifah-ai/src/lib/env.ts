import 'server-only';

/**
 * قراءة متغيرات البيئة والتحقق منها في مكان واحد.
 * أي مفتاح سري يُقرأ هنا لا يصل إلى المتصفح إطلاقًا ('server-only').
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `متغير البيئة ${name} غير مضبوط. راجع ملف .env.example وانسخه إلى .env.local`,
    );
  }
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const serverEnv = {
  get supabaseUrl() {
    return required('NEXT_PUBLIC_SUPABASE_URL');
  },
  get supabaseAnonKey() {
    return required('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  },
  get supabaseServiceRoleKey() {
    return required('SUPABASE_SERVICE_ROLE_KEY');
  },
  get anthropicApiKey() {
    return required('ANTHROPIC_API_KEY');
  },
  get anthropicModel() {
    return optional('ANTHROPIC_MODEL', 'claude-opus-5');
  },
  get anthropicEffort() {
    const value = optional('ANTHROPIC_EFFORT', 'medium');
    const allowed = ['low', 'medium', 'high', 'xhigh', 'max'];
    return allowed.includes(value) ? value : 'medium';
  },
  get anthropicMaxOutputTokens() {
    // على claude-opus-5 التفكير مفعّل تلقائيًا ما لم يُعطَّل صراحةً، و
    // max_tokens سقف لمجموع (التفكير + نص الإجابة) لا للإجابة وحدها.
    // قيمة ضيقة كـ2000 قد يستهلكها التفكير فتُبتر الإجابة العربية في
    // منتصفها بلا خطأ — يعود stop_reason = 'max_tokens' فقط.
    return optionalInt('ANTHROPIC_MAX_OUTPUT_TOKENS', 8000);
  },
  get embeddingsProvider() {
    const value = optional('EMBEDDINGS_PROVIDER', 'local');
    return (['voyage', 'openai', 'local'].includes(value) ? value : 'local') as
      | 'voyage'
      | 'openai'
      | 'local';
  },
  get embeddingsDimensions() {
    return optionalInt('EMBEDDINGS_DIMENSIONS', 1024);
  },
  get voyageApiKey() {
    return optional('VOYAGE_API_KEY');
  },
  get voyageModel() {
    return optional('VOYAGE_MODEL', 'voyage-3.5');
  },
  get openaiApiKey() {
    return optional('OPENAI_API_KEY');
  },
  get openaiEmbeddingsModel() {
    return optional('OPENAI_EMBEDDINGS_MODEL', 'text-embedding-3-small');
  },
  get openaiBaseUrl() {
    return optional('OPENAI_BASE_URL', 'https://api.openai.com/v1');
  },
  get internalApiSecret() {
    return optional('INTERNAL_API_SECRET');
  },
  get appUrl() {
    return optional('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
  },
  get isProduction() {
    return process.env.NODE_ENV === 'production';
  },
};

/**
 * فحص أن الإعدادات الأساسية موجودة — يُستدعى من /api/health.
 */
export function checkConfiguration(): {
  ok: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];

  const requiredKeys = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];
  for (const key of requiredKeys) {
    if (!process.env[key]) missing.push(key);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    warnings.push('ANTHROPIC_API_KEY غير مضبوط — المساعد الذكي معطّل.');
  }

  const provider = process.env.EMBEDDINGS_PROVIDER || 'local';
  if (provider === 'voyage' && !process.env.VOYAGE_API_KEY) {
    warnings.push('EMBEDDINGS_PROVIDER=voyage لكن VOYAGE_API_KEY غير مضبوط.');
  }
  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    warnings.push('EMBEDDINGS_PROVIDER=openai لكن OPENAI_API_KEY غير مضبوط.');
  }
  if (provider === 'local') {
    warnings.push(
      'مزوّد التضمينات المحلي مخصص للتطوير فقط؛ جودة الاسترجاع ستكون ضعيفة.',
    );
  }

  return { ok: missing.length === 0, missing, warnings };
}
