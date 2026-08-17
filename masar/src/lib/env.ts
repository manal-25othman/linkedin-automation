import 'server-only';

/**
 * قراءة متغيرات البيئة في مكان واحد.
 * أي قيمة تُقرأ هنا لا تصل إلى المتصفح إطلاقًا ('server-only').
 */

function optional(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

function readEffort(): EffortLevel {
  const raw = optional('ANTHROPIC_EFFORT', 'high');
  return (EFFORT_LEVELS as readonly string[]).includes(raw)
    ? (raw as EffortLevel)
    : 'high';
}

export const serverEnv = {
  get anthropicApiKey(): string {
    const value = process.env.ANTHROPIC_API_KEY?.trim();
    if (!value) {
      throw new Error(
        'متغير البيئة ANTHROPIC_API_KEY غير مضبوط. انسخ .env.example إلى .env.local وأكمله.',
      );
    }
    return value;
  },
  get anthropicModel(): string {
    return optional('ANTHROPIC_MODEL', 'claude-opus-5');
  },
  get anthropicEffort(): EffortLevel {
    return readEffort();
  },
  get anthropicMaxOutputTokens(): number {
    return optionalInt('ANTHROPIC_MAX_OUTPUT_TOKENS', 32_000);
  },
};

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}
