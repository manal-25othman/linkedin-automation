'use client';

import { useState, useTransition } from 'react';
import { Check, Copy, MessageCircle, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  requestWhatsAppLinkCodeAction,
  unlinkWhatsAppAction,
} from '@/app/(dashboard)/settings/profile/whatsapp-actions';

/**
 * بطاقة ربط واتساب.
 *
 * الرمز يُعرض مرة واحدة بعد الطلب ولا يُخزَّن في الواجهة: عرضه دائمًا
 * يجعل لقطة شاشة قديمة كافية لربط هاتف غريب ما دام الرمز صالحًا.
 */
export function WhatsAppLinkCard({
  businessNumber,
  linkedPhone,
}: {
  /** رقم واتساب الذي يُرسَل إليه الرمز — فارغ يعني أن القناة غير مُهيّأة */
  businessNumber: string;
  linkedPhone: string | null;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function requestCode() {
    setError(null);
    startTransition(async () => {
      const result = await requestWhatsAppLinkCodeAction();
      if (result.ok && result.code) setCode(result.code);
      else setError(result.message ?? 'تعذّر توليد الرمز.');
    });
  }

  function unlink() {
    setError(null);
    setCode(null);
    startTransition(async () => {
      const result = await unlinkWhatsAppAction();
      if (!result.ok) setError(result.message ?? 'تعذّر إزالة الربط.');
    });
  }

  if (!businessNumber) {
    return (
      <p className="text-sm leading-relaxed text-muted-foreground">
        قناة واتساب غير مُفعّلة في هذه المنصة بعد.
      </p>
    );
  }

  if (linkedPhone) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="success">مرتبط</Badge>
          <span className="numeric text-sm" dir="ltr">
            +{linkedPhone}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          تستطيع سؤال مساعد شركتك من واتساب مباشرة. الإجابات تخضع لصلاحياتك نفسها — لا ترى
          عبر واتساب ما لا تراه في المنصة.
        </p>
        <Button variant="outline" size="sm" onClick={unlink} disabled={isPending}>
          <Unlink className="size-4" aria-hidden />
          إزالة الربط
        </Button>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        اربط رقمك لتسأل مساعد شركتك من واتساب. الربط يتطلّب إثبات حيازتك للهاتف، فلا يستطيع
        أحد ربط رقمك نيابةً عنك.
      </p>

      {code ? (
        <div className="rounded-lg border bg-muted/40 p-4">
          <p className="text-xs text-muted-foreground">أرسل هذا الرمز إلى:</p>
          <p className="numeric mt-1 text-sm font-semibold" dir="ltr">
            +{businessNumber}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <code className="rounded-md border bg-background px-3 py-2 text-base font-bold tracking-wider">
              {code}
            </code>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="نسخ الرمز"
              onClick={() => {
                navigator.clipboard.writeText(code);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
            >
              {copied ? (
                <Check className="size-4 text-[hsl(var(--success))]" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
            </Button>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            الرمز صالح عشر دقائق ولمرة واحدة. بعد إرساله ستصلك رسالة تأكيد، ثم حدّث هذه
            الصفحة.
          </p>

          <Button asChild size="sm" className="mt-3">
            <a
              href={`https://wa.me/${businessNumber}?text=${encodeURIComponent(code)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="size-4" aria-hidden />
              افتح واتساب وأرسل الرمز
            </a>
          </Button>
        </div>
      ) : (
        <Button onClick={requestCode} disabled={isPending}>
          <MessageCircle className="size-4" aria-hidden />
          {isPending ? 'جارٍ التوليد…' : 'اربط واتساب'}
        </Button>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
