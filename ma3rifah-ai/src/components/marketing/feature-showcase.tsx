'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BadgeCheck, Languages, ScanSearch } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * عرض المميزات.
 *
 * كانت البطاقات مكدّسة رأسيًّا، فتُقرأ الأولى وتُتخطّى البقية. والمعتاد
 * في مكانها «سلايدر» — لكن الشريحة تُخفي ما عداها، فيمرّ الزائر على
 * ميزة واحدة ويظنّها كلّ ما عندنا، ولا يعرف أن وراءها اثنتين.
 *
 * فبُنيت لسانًا لا شريحة: العناوين الثلاثة ظاهرة معًا دائمًا، والشرح
 * وحده يتبدّل. فيرى الزائر المدى كلّه في لحظة، ويقرأ ما يختاره هو.
 *
 * ويتقدّم وحده كي يُرى أن ثمّة مزيدًا، ويقف عند أول لمسة أو تحويم:
 * التقدّم التلقائي الذي يقاطع القارئ أسوأ من السكون.
 *
 * وشريط التقدّم مربوطٌ بالمؤقّت نفسه، فما يُرى هو ما يجري — لا رسمٌ
 * يوهم بمهلة أخرى.
 */

const ICONS = [Languages, BadgeCheck, ScanSearch];
const ADVANCE_MS = 7000;

export interface ShowcaseItem {
  badge?: string;
  title: string;
  description: string;
}

export function FeatureShowcase({ items }: { items: ShowcaseItem[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  /** تُحسم مرّة واحدة على العميل — لا تُقرأ في التصيير الأول */
  const [motionOk, setMotionOk] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setMotionOk(!query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (paused || !motionOk || items.length < 2) return;
    const timer = window.setTimeout(
      () => setActive((current) => (current + 1) % items.length),
      ADVANCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [active, paused, motionOk, items.length]);

  /** أسهم لوحة المفاتيح — نمط الألسنة القياسي، معكوسًا للعربية */
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const step =
        event.key === 'ArrowLeft' ? 1 : event.key === 'ArrowRight' ? -1 : 0;
      if (step === 0) return;
      event.preventDefault();
      setPaused(true);
      const next = (active + step + items.length) % items.length;
      setActive(next);
      tabRefs.current[next]?.focus();
    },
    [active, items.length],
  );

  if (items.length === 0) return null;

  return (
    <div
      className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
    >
      <div
        role="tablist"
        aria-label="مميزات المنصة"
        aria-orientation="vertical"
        onKeyDown={onKeyDown}
        // يلتفّ ولا ينزلق: اللسان الذي يخرج خارج الحافة لا يُعرف أنه هناك
        className="flex flex-wrap gap-2 lg:flex-col lg:flex-nowrap"
      >
        {items.map((item, index) => {
          const Icon = ICONS[index % ICONS.length];
          const selected = index === active;
          return (
            <button
              key={item.title}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`showcase-tab-${index}`}
              aria-selected={selected}
              aria-controls={`showcase-panel-${index}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                setPaused(true);
                setActive(index);
              }}
              className={cn(
                'group relative flex-1 overflow-hidden rounded-xl border p-4 text-start transition-colors lg:flex-none',
                selected
                  ? 'border-primary/40 bg-card shadow-sm'
                  : 'border-transparent bg-muted/40 hover:bg-muted/70',
              )}
            >
              <span className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                    selected
                      ? 'bg-primary/10 text-primary'
                      : 'bg-background text-muted-foreground',
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                {/*
                 * الوسم هو العنوان هنا لا العنوان نفسه: كلمة واحدة
                 * («العربية») تسع الشاشات الصغيرة فتظهر الألسنة الثلاثة
                 * معًا، والعنوان الكامل بطوله كان يدفع ثالثها خارج
                 * الحافة فيُظنّ غير موجود.
                 *
                 * وفيه فائدة ثانية: العنوان الكامل يبقى للّوح وحده،
                 * فلا يُقرأ مرّتين متجاورتين.
                 */}
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block text-sm font-medium',
                      selected ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {item.badge ?? item.title}
                  </span>
                  {item.badge ? (
                    <span className="mt-0.5 hidden text-xs leading-snug text-muted-foreground lg:line-clamp-2 lg:block">
                      {item.title}
                    </span>
                  ) : null}
                </span>
              </span>

              {/* شريط التقدّم — مربوط بالمؤقّت نفسه، ويختفي حين يقف */}
              {selected && motionOk && !paused && items.length > 1 ? (
                <span
                  key={`progress-${active}`}
                  className="showcase-progress absolute bottom-0 h-0.5 bg-primary/60"
                  style={{ animationDuration: `${ADVANCE_MS}ms`, insetInlineStart: 0 }}
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {/*
       * كل الألواح تُصيَّر، والمخفيّ منها يُخفى بـ`hidden` لا يُحذف.
       * فالشرح الذي لا يدخل الصفحة لا يقرؤه محرّك بحث ولا قارئ شاشة
       * يتصفّح النصّ — وثلثا المحتوى كان سيغيب.
       */}
      <div className="relative">
        {items.map((item, index) => {
          const Icon = ICONS[index % ICONS.length];
          return (
            <div
              key={item.title}
              role="tabpanel"
              id={`showcase-panel-${index}`}
              aria-labelledby={`showcase-tab-${index}`}
              hidden={index !== active}
              tabIndex={0}
              className="rounded-2xl border bg-card p-6 sm:p-8"
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="size-6 text-primary" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  {item.badge ? (
                    <Badge variant="secondary" className="mb-2">
                      {item.badge}
                    </Badge>
                  ) : null}
                  <h3 className="text-lg font-semibold leading-snug">{item.title}</h3>
                  <p className="mt-3 text-sm leading-loose text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
