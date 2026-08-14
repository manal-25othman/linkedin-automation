'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * إظهار العنصر عند دخوله إطار الشاشة.
 *
 * تُبنى الحالة الابتدائية في CSS لا في JS كي لا يومض المحتوى ظاهرًا ثم
 * يختفي قبل أن يعمل السكربت. وإن تعذّر IntersectionObserver أو عُطّلت
 * الحركة، يظهر المحتوى فورًا — الحركة تحسين لا شرط للقراءة.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  variant = 'up',
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  /** تأخير بالمللي ثانية — للتسلسل داخل الشبكة الواحدة */
  delay?: number;
  variant?: 'up' | 'scale';
  as?: 'div' | 'section' | 'li' | 'article';
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        }
      },
      // يبدأ الظهور قبل بلوغ الحافة بقليل، فيكتمل مع وصول العين
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // العنصر المُصيَّر يتغيّر بحسب `as`، فيتعذّر على TypeScript توحيد نوع
  // المرجع بين div و li و section — والمراقب لا يحتاج غير Element.
  const setRef = (node: HTMLElement | null) => {
    ref.current = node;
  };

  return (
    <Tag
      ref={setRef}
      className={cn(
        'reveal',
        isVisible && (variant === 'scale' ? 'reveal-in-scale' : 'reveal-in'),
        className,
      )}
      style={isVisible && delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
