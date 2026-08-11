/**
 * تسجيل مُهيكل.
 *
 * لا يُسجَّل أبدًا: كلمات المرور، مفاتيح API، الرموز، أو محتوى المستندات.
 * نصوص أسئلة المستخدمين تُختصر إلى طول محدود لأغراض التشخيص فقط.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEYS = [
  'password',
  'token',
  'api_key',
  'apikey',
  'secret',
  'authorization',
  'access_token',
  'refresh_token',
  'service_role',
  'embedding',
  'content',
];

const REDACTED = '[محذوف]';

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return REDACTED;
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.length > 20
      ? `[مصفوفة بطول ${value.length}]`
      : value.map((item) => redact(item, depth + 1));
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))
        ? REDACTED
        : redact(item, depth + 1);
    }
    return out;
  }

  if (typeof value === 'string' && value.length > 500) {
    return `${value.slice(0, 500)}…`;
  }

  return value;
}

function emit(level: Level, message: string, context?: Record<string, unknown>) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? { context: redact(context) } : {}),
  };

  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else if (level === 'debug') {
    if (process.env.NODE_ENV !== 'production') console.debug(line);
  } else console.log(line);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => emit('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => emit('error', message, context),
};
