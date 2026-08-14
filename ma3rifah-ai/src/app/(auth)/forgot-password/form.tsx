'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { requestPasswordResetAction } from '../actions';
import { AUTH_INITIAL_STATE } from '../form-state';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'جارٍ الإرسال…' : 'أرسل الرابط'}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, AUTH_INITIAL_STATE);

  if (state.status === 'success') {
    return (
      <div className="rounded-lg border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 p-5">
        <CheckCircle2 className="size-5 text-[hsl(var(--success))]" aria-hidden />
        <p className="mt-2 text-sm leading-relaxed">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">البريد الإلكتروني</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          dir="ltr"
          className="text-start"
          autoComplete="email"
        />
      </div>

      {state.status === 'error' ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
