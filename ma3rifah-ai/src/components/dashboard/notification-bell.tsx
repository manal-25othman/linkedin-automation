'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { markNotificationsReadAction } from '@/app/(dashboard)/notifications-actions';
import { formatRelativeTime } from '@/lib/utils';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

/**
 * جرس التنبيهات.
 *
 * لا تُعلَّم التنبيهات مقروءة بمجرد فتح القائمة: الفتح العابر لا يعني
 * القراءة، ولو عُدَّ كذلك لضاع التنبيه على من فتح ثم أُلهي عنه. التعليم
 * بفعل صريح — نقر التنبيه أو زر «تعليم الكل».
 */
export function NotificationBell({ initial }: { initial: NotificationItem[] }) {
  const [items, setItems] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const unreadCount = items.filter((item) => !item.readAt).length;

  function markRead(ids: string[]) {
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    setItems((current) =>
      current.map((item) => (ids.includes(item.id) ? { ...item, readAt: now } : item)),
    );
    startTransition(async () => {
      await markNotificationsReadAction(ids);
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={unreadCount > 0 ? `التنبيهات — ${unreadCount} غير مقروء` : 'التنبيهات'}
      >
        <Bell className="size-5" aria-hidden />
        {unreadCount > 0 ? (
          <span className="absolute -top-0.5 end-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <p className="text-sm font-semibold">التنبيهات</p>
          {unreadCount > 0 ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => markRead(items.filter((item) => !item.readAt).map((i) => i.id))}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
            >
              <CheckCheck className="size-3.5" aria-hidden />
              تعليم الكل كمقروء
            </button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            لا توجد تنبيهات بعد.
          </p>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {items.map((item) => {
              const content = (
                <>
                  <div className="flex items-start gap-2">
                    {!item.readAt ? (
                      <span
                        className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                        aria-label="غير مقروء"
                      />
                    ) : (
                      <span className="mt-1.5 size-2 shrink-0" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{item.title}</p>
                      {item.body ? (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {item.body}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatRelativeTime(item.createdAt)}
                      </p>
                    </div>
                  </div>
                </>
              );

              return (
                <li key={item.id} className="border-b last:border-0">
                  {item.link ? (
                    <Link
                      href={item.link}
                      onClick={() => markRead([item.id])}
                      className="block px-3 py-2.5 transition-colors hover:bg-accent"
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => markRead([item.id])}
                      className="block w-full px-3 py-2.5 text-start transition-colors hover:bg-accent"
                    >
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
