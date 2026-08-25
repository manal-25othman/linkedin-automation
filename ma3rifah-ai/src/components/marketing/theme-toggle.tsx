'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * مبدّل السمة.
 *
 * الحسم الأول يقع في نصٍّ صغير داخل `<head>` قبل الرسم، فلا ومضة.
 * وهذا المكوّن يقرأ ما استقرّ عليه ويقلبه — ولا يقرّر ابتداءً.
 *
 * ولا يُرسَم شيء قبل أن يعمل العميل: لو صيّرنا أيقونةً افتراضية على
 * الخادم لظهرت الشمس لمن سمته داكنة، ثم انقلبت أمامه. والفراغ لحظةً
 * أهون من كذبٍ يُصحَّح.
 */
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    document.documentElement.style.colorScheme = next ? 'dark' : 'light';
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      // التخزين قد يكون ممنوعًا في تصفّح خاصّ — والقلب يعمل دونه
    }
    setDark(next);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="rounded-full text-muted-foreground hover:text-foreground"
      aria-label={dark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
      title={dark ? 'الوضع الفاتح' : 'الوضع الداكن'}
    >
      {dark === null ? (
        <span className="size-5" aria-hidden />
      ) : dark ? (
        <Sun className="size-5" aria-hidden />
      ) : (
        <Moon className="size-5" aria-hidden />
      )}
    </Button>
  );
}
