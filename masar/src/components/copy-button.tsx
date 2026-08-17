'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button, type ButtonProps } from '@/components/ui/primitives';

/**
 * زر نسخ.
 *
 * navigator.clipboard غير متاح على HTTP ولا في بعض المتصفحات القديمة،
 * فيسقط إلى textarea مؤقت. بدون هذا السقوط يفشل النسخ صامتًا على أي نشر
 * محلي بلا شهادة — وهو أول ما يجرّبه المستخدم.
 */
async function writeToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // نتابع إلى الطريقة البديلة
    }
  }

  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
  }
}

export function CopyButton({
  value,
  label = 'نسخ',
  size = 'sm',
  variant = 'secondary',
}: {
  value: string;
  label?: string;
  size?: ButtonProps['size'];
  variant?: ButtonProps['variant'];
}) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={async () => {
        const ok = await writeToClipboard(value);
        if (ok) {
          setCopied(true);
        } else {
          toast.error('تعذّر النسخ تلقائيًا. حدّد النص وانسخه يدويًا.');
        }
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? 'نُسخ' : label}
    </Button>
  );
}
