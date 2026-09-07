'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * حركة تتبع المؤشّر — للحاسب وحده.
 *
 * تُحسم على العميل: لا حركة تتبّع على شاشة لمس (لا مؤشّر أصلًا)، ولا مع
 * «تقليل الحركة». وقبل أن يُحسم شيء تُرسم الصفحة ساكنة، فلا ومضة.
 */
function usePointerMotion(): boolean {
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const sync = () => setOk(!reduced.matches && fine.matches);
    sync();
    reduced.addEventListener('change', sync);
    fine.addEventListener('change', sync);
    return () => {
      reduced.removeEventListener('change', sync);
      fine.removeEventListener('change', sync);
    };
  }, []);

  return ok;
}

/**
 * ميلٌ ثلاثيّ الأبعاد يتبع المؤشّر، مع لمعة تتحرّك معه.
 *
 * الزاوية صغيرة عمدًا: الميل الكبير يُقرأ لعبة، والصغير يُقرأ عمقًا.
 */
export function TiltCard({
  children,
  className,
  max = 5,
}: {
  children: React.ReactNode;
  className?: string;
  /** أقصى زاوية بالدرجات */
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ok = usePointerMotion();

  const reset = () => {
    const node = ref.current;
    if (!node) return;
    node.style.setProperty('--rx', '0deg');
    node.style.setProperty('--ry', '0deg');
  };

  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const node = ref.current;
    if (!ok || !node) return;
    const rect = node.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    node.style.setProperty('--rx', `${(-py * max).toFixed(2)}deg`);
    node.style.setProperty('--ry', `${(px * max).toFixed(2)}deg`);
    node.style.setProperty('--gx', `${((px + 0.5) * 100).toFixed(1)}%`);
    node.style.setProperty('--gy', `${((py + 0.5) * 100).toFixed(1)}%`);
  };

  return (
    <div
      ref={ref}
      className={cn('mk-tilt', className)}
      onPointerMove={onMove}
      onPointerLeave={reset}
    >
      {children}
      <span className="mk-glare" aria-hidden />
    </div>
  );
}

/**
 * مجموعة بطاقات يضيء فيها موضع المؤشّر.
 *
 * يُحسب موضع المؤشّر لكل بطاقة ويُكتب في متغيّرين، والرسم في CSS.
 * حاوية واحدة تستمع بدل مستمعٍ في كل بطاقة.
 */
export function SpotlightGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ok = usePointerMotion();

  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const root = ref.current;
    if (!ok || !root) return;
    for (const card of root.querySelectorAll<HTMLElement>('.mk-card')) {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${event.clientX - rect.left}px`);
      card.style.setProperty('--my', `${event.clientY - rect.top}px`);
    }
  };

  return (
    <div ref={ref} className={cn('mk-spot', className)} onPointerMove={onMove}>
      {children}
    </div>
  );
}

/**
 * شريط تقدّم القراءة أعلى الصفحة.
 *
 * يُحدَّث داخل requestAnimationFrame فلا يُثقل التمرير، ويُخفى عن
 * القارئ الصوتيّ لأنه زينة تعبّر عمّا يعرفه المتصفح أصلًا.
 */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const node = ref.current;
      if (!node) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      node.style.transform = `scaleX(${ratio.toFixed(4)})`;
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return <div ref={ref} className="mk-progress" aria-hidden />;
}
