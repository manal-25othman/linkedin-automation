/**
 * تسجيل مُهيكل بسيط.
 *
 * لا يُسجَّل نص السيرة الذاتية ولا نص الوظيفة إطلاقًا: هما بيانات العميل،
 * وتسجيلهما يحوّل ملف السجل إلى مخزن سير ذاتية بلا سياسة احتفاظ.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, message: string, context?: Record<string, unknown>) {
  const line = {
    level,
    message,
    time: new Date().toISOString(),
    ...(context ?? {}),
  };

  const serialized = JSON.stringify(line);
  if (level === 'error') console.error(serialized);
  else if (level === 'warn') console.warn(serialized);
  else console.log(serialized);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'production') emit('debug', message, context);
  },
  info: (message: string, context?: Record<string, unknown>) => emit('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => emit('error', message, context),
};
