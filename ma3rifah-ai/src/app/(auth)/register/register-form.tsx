'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { AlertCircle, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { registerAction } from '../actions';
import { AUTH_INITIAL_STATE } from '../form-state';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" size="lg" loading={pending}>
      {pending ? 'جاري إنشاء الحساب…' : 'ابدأ التجربة'}
    </Button>
  );
}

export function RegisterForm({
  inviteRequired,
  presetCode,
}: {
  inviteRequired: boolean;
  presetCode?: string;
}) {
  const [state, formAction] = useActionState(registerAction, AUTH_INITIAL_STATE);

  if (state.status === 'pending_confirmation') {
    return (
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-6 text-center">
        <MailCheck className="mx-auto size-9 text-primary" aria-hidden />
        <h2 className="mt-4 text-base font-semibold">تحقق من بريدك الإلكتروني</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.status === 'error' ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3.5"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p className="text-sm text-destructive">{state.message}</p>
        </div>
      ) : null}

      {inviteRequired ? (
        <div className="space-y-2">
          <Label htmlFor="inviteCode">رمز الدعوة</Label>
          <Input
            id="inviteCode"
            name="inviteCode"
            required
            defaultValue={presetCode}
            maxLength={64}
            autoComplete="off"
            spellCheck={false}
            dir="ltr"
            className="text-start font-mono tracking-wide"
            placeholder="ALFA-2026"
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            التسجيل بدعوة في هذه المرحلة. إن لم يكن لديكِ رمز،{' '}
            <a href="/contact" className="font-medium text-primary underline underline-offset-4">
              اطلب دعوة
            </a>
            .
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="fullName">الاسم الكامل</Label>
        <Input id="fullName" name="fullName" required autoComplete="name" maxLength={120} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="companyName">اسم الشركة</Label>
        <Input
          id="companyName"
          name="companyName"
          required
          autoComplete="organization"
          maxLength={150}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="jobTitle">المسمّى الوظيفي (اختياري)</Label>
        <Input id="jobTitle" name="jobTitle" autoComplete="organization-title" maxLength={120} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">البريد الإلكتروني للعمل</Label>
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
          autoComplete="new-password"
          dir="ltr"
          className="text-start"
          minLength={8}
        />
        <p className="text-xs text-muted-foreground">
          8 أحرف على الأقل، وتحتوي على حرف ورقم.
        </p>
      </div>

      <SubmitButton />

      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        بإنشائك حسابًا فأنت توافق على شروط الاستخدام وسياسة الخصوصية.
      </p>
    </form>
  );
}
