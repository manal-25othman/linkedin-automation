'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginAction } from '../actions';
import { AUTH_INITIAL_STATE } from '../form-state';

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

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="redirectTo" value={redirectTo} />

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
        <Label htmlFor="password">كلمة المرور</Label>
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
