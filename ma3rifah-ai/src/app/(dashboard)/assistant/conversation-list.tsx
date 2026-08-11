'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { MessageSquarePlus, MoreVertical, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatRelativeTime, truncate } from '@/lib/utils';
import { deleteConversationAction } from './actions';

export interface ConversationSummary {
  id: string;
  title: string;
  lastMessageAt: string | null;
}

export function ConversationList({
  conversations,
  activeId,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const remove = (id: string) => {
    startTransition(async () => {
      const result = await deleteConversationAction(id);
      if (!result.ok) {
        toast.error(result.message ?? 'تعذّر حذف المحادثة.');
        return;
      }
      toast.success('تم حذف المحادثة.');
      if (activeId === id || pathname.includes(id)) {
        router.push('/assistant');
      }
      router.refresh();
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <Button variant="outline" className="w-full justify-start" asChild>
          <Link href="/assistant">
            <MessageSquarePlus className="size-4" aria-hidden />
            محادثة جديدة
          </Link>
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3 thin-scrollbar">
        {conversations.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs leading-relaxed text-muted-foreground">
            لا توجد محادثات سابقة.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {conversations.map((conversation) => {
              const isActive = conversation.id === activeId;
              return (
                <li key={conversation.id} className="group relative">
                  <Link
                    href={`/assistant/${conversation.id}`}
                    className={cn(
                      'block rounded-md px-3 py-2.5 pe-9 transition-colors',
                      isActive ? 'bg-primary/10' : 'hover:bg-accent',
                    )}
                  >
                    <p
                      className={cn(
                        'truncate text-sm font-medium',
                        isActive ? 'text-primary' : 'text-foreground',
                      )}
                    >
                      {truncate(conversation.title, 40)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatRelativeTime(conversation.lastMessageAt)}
                    </p>
                  </Link>

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="absolute end-1 top-2 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-background focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                      aria-label="خيارات المحادثة"
                    >
                      <MoreVertical className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        disabled={isPending}
                        onSelect={() => remove(conversation.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 aria-hidden />
                        حذف المحادثة
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
