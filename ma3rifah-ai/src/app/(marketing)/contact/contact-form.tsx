'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { submitContactRequest, type ContactFormState } from './actions';

const INITIAL_STATE: ContactFormState = { status: 'idle', message: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" loading={pending}>
      {pending ? 'جاري الإرسال…' : 'إرسال الطلب'}
    </Button>
  );
}

export function ContactForm() {
  const [state, formAction] = useActionState(submitContactRequest, INITIAL_STATE);

  if (state.status === 'success') {
    return (
      <div className="rounded-xl border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5 p-8 text-center">
        <CheckCircle2
          className="mx-auto size-10 text-[hsl(var(--success))]"
          aria-hidden
        />
        <h3 className="mt-4 text-lg font-semibold">تم استلام طلبك</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.status === 'error' ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p className="text-sm text-destructive">{state.message}</p>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">الاسم الكامل *</Label>
          <Input id="fullName" name="fullName" required autoComplete="name" maxLength={120} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">البريد الإلكتروني للعمل *</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            dir="ltr"
            className="text-start"
            maxLength={255}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="companyName">اسم الشركة *</Label>
          <Input
            id="companyName"
            name="companyName"
            required
            autoComplete="organization"
            maxLength={150}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">رقم الجوال</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            dir="ltr"
            className="text-start"
            maxLength={30}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="companySize">عدد الموظفين</Label>
        <select
          id="companySize"
          name="companySize"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          defaultValue=""
        >
          <option value="">اختر…</option>
          <option value="1-20">1 – 20</option>
          <option value="21-100">21 – 100</option>
          <option value="101-500">101 – 500</option>
          <option value="500+">أكثر من 500</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">كيف يمكننا مساعدتك؟ *</Label>
        <Textarea
          id="message"
          name="message"
          required
          rows={5}
          maxLength={4000}
          placeholder="أخبرنا عن نوع المستندات لديكم، وحجم الفريق، وما تأملون تحقيقه."
        />
      </div>

      {/* مصيدة للإرسال الآلي — مخفية عن المستخدمين وقارئات الشاشة */}
      <div aria-hidden className="hidden">
        <label htmlFor="website">لا تملأ هذا الحقل</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <SubmitButton />

      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        بإرسالك هذا الطلب توافق على تواصلنا معك بخصوص المنتج. لن نشارك بياناتك مع أي جهة أخرى.
      </p>
    </form>
  );
}
