'use client';

import Link from 'next/link';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginAction } from '../actions';
import { AUTH_INITIAL_STATE } from '../form-state';

/**
 * أسباب ردّ مسار /auth/callback إلى صفحة الدخول.
 *
 * يصل القادم من رابط بريد فاشل إلى هنا، ولو صمتت الصفحة لرأى نموذج دخول
 * عاديًا بلا تفسير — فيظن أن الرابط عمل وأن كلمة مروره هي التي لا تصح،
 * ويعيد الكرّة على الخطأ نفسه.
 */
const LINK_ERRORS: Record<string, string> = {
  link_expired:
    'انتهت صلاحية الرابط أو استُعمل من قبل. اطلب رابطًا جديدًا من «نسيت كلمة المرور؟».',
  link_invalid: 'الرابط غير صالح. اطلب رابطًا جديدًا من «نسيت كلمة المرور؟».',
  account_disabled: 'هذا الحساب معطّل. تواصل مع مدير الشركة.',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" size="lg" loading={pending}>
      {pending ? 'جاري تسجيل الدخول…' : 'تسجيل الدخول'}
    </Button>
  );
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') ?? '/dashboard';
  const [state, formAction] = useActionState(loginAction, AUTH_INITIAL_STATE);

  // خطأ المحاولة الحالية أولى بالعرض من سبب وصولٍ سابق إلى الصفحة
  const linkError = state.status === 'error' ? null : LINK_ERRORS[searchParams.get('error') ?? ''];

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="redirectTo" value={redirectTo} />

      {linkError ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 p-3.5"
        >
          <AlertCircle
            className="mt-0.5 size-4 shrink-0 text-[hsl(var(--warning))]"
            aria-hidden
          />
          <p className="text-sm">{linkError}</p>
        </div>
      ) : null}

      {state.status === 'error' ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3.5"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p className="text-sm text-destructive">{state.message}</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">البريد الإلكتروني</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          dir="ltr"
          className="text-start"
          placeholder="name@company.com"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="password">كلمة المرور</Label>
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-primary hover:underline"
          >
            نسيت كلمة المرور؟
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          dir="ltr"
          className="text-start"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
