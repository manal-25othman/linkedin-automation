/**
 * نداء الواجهة البرمجية من المتصفح.
 *
 * المسارات تُعيد الأخطاء بشكل { error: { code, message } } برسالة عربية
 * جاهزة للعرض، فيُستخرج منها الرسالة بدل عرض «HTTP 500» للمستخدم.
 */

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string } };
    return new ApiError(
      body.error?.message ?? 'حدث خطأ غير متوقع.',
      body.error?.code ?? 'INTERNAL',
      response.status,
    );
  } catch {
    return new ApiError('تعذّر الاتصال بالخادم. حاول مرة أخرى.', 'INTERNAL', response.status);
  }
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw await parseError(response);
  return (await response.json()) as T;
}

export async function postForm<T>(url: string, form: FormData): Promise<T> {
  const response = await fetch(url, { method: 'POST', body: form });
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as T;
}

export async function postForBlob(url: string, body: unknown): Promise<Blob> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw await parseError(response);
  return response.blob();
}

export function messageOf(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'حدث خطأ غير متوقع.';
}
