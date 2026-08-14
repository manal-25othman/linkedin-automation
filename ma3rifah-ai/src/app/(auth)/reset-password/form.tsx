'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updatePasswordAction } from '../actions';
import { AUTH_INITIAL_STATE } from '../form-state';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور'}
    </Button>
  );
}

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, AUTH_INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="password">كلمة المرور الجديدة</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          dir="ltr"
          className="text-start"
          autoComplete="new-password"
        />
        <p className="text-xs text-muted-foreground">٨ محارف على الأقل.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          dir="ltr"
          className="text-start"
          autoComplete="new-password"
        />
      </div>

      {state.status === 'error' ? (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{state.message}</p>
          <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            اطلب رابطًا جديدًا
          </Link>
        </div>
      ) : null}

      <SubmitButton />
    </form>
  );
}
