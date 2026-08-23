'use client';

import { useState, useTransition } from 'react';
import { Plus, Server } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { addPlatformExpenseAction, endPlatformExpenseAction } from '@/app/admin/actions';

interface Expense {
  id: string;
  label: string;
  amount_usd: number;
  starts_on: string;
  ends_on: string | null;
  note: string | null;
}

/**
 * محرّر المصاريف الثابتة.
 *
 * والمصروف **يُنهى ولا يُحذف**: الحذف يزوّر الماضي، إذ يختفي من الأشهر
 * التي دُفع فيها فعلًا فيرتفع ربحُ شهرٍ مضى بأثر رجعي. والإنهاء يوقفه
 * من تاريخه ويترك التاريخ كما كان.
 */
export function ExpensesEditor({ expenses }: { expenses: Expense[] }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');

  const today = new Date().toISOString().slice(0, 10);
  const active = expenses.filter((item) => !item.ends_on || item.ends_on >= today);
  const totalUsd = active.reduce((sum, item) => sum + Number(item.amount_usd), 0);

  const submit = () => {
    const amountUsd = Number(amount);
    if (!label.trim() || !Number.isFinite(amountUsd) || amountUsd < 0) {
      setMessage({ ok: false, text: 'أدخلي اسمًا ومبلغًا صحيحًا.' });
      return;
    }

    startTransition(async () => {
      const result = await addPlatformExpenseAction({
        label,
        amountUsd,
        // من أول الشهر الجاري — المصروف شهريّ لا يوميّ
        startsOn: `${today.slice(0, 7)}-01`,
      });
      setMessage({ ok: result.ok, text: result.message ?? '' });
      if (result.ok) {
        setLabel('');
        setAmount('');
      }
    });
  };

  const end = (id: string) => {
    startTransition(async () => {
      const result = await endPlatformExpenseAction(id, today);
      setMessage({ ok: result.ok, text: result.message ?? '' });
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Server className="size-4 text-primary" aria-hidden />
          المصاريف الثابتة
          <Badge variant="secondary">
            <span className="numeric">{totalUsd.toFixed(0)}</span>$ شهريًا
          </Badge>
        </CardTitle>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          الاستضافة والقاعدة والأدوات والاشتراكات. تُدخَل هنا لأنها لا تمرّ
          بالمنتج فلا يعرفها. والمصروف يُنهى ولا يُحذف — الحذف يرفع ربح شهرٍ
          مضى بأثر رجعي.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-40 flex-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="expense-label">
              البند
            </label>
            <Input
              id="expense-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Supabase Pro"
              className="mt-1"
            />
          </div>
          <div className="w-32">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="expense-amount">
              دولار/شهر
            </label>
            <Input
              id="expense-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="25"
              className="mt-1"
            />
          </div>
          <Button onClick={submit} disabled={pending}>
            <Plus className="size-4" aria-hidden />
            إضافة
          </Button>
        </div>

        {message ? (
          <p
            className={
              message.ok
                ? 'text-sm text-[hsl(var(--success))]'
                : 'text-sm text-destructive'
            }
            role="status"
          >
            {message.text}
          </p>
        ) : null}

        {expenses.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            لا مصاريف مسجّلة. وما دامت فارغة فالربح المعروض أعلى من الحقيقي.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {expenses.map((item) => {
              const ended = Boolean(item.ends_on && item.ends_on < today);
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className={ended ? 'text-sm text-muted-foreground' : 'text-sm font-medium'}>
                      {item.label}
                      {ended ? <Badge variant="secondary" className="ms-2">منتهٍ</Badge> : null}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      من {formatDate(item.starts_on)}
                      {item.ends_on ? ` إلى ${formatDate(item.ends_on)}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="numeric text-sm font-semibold">
                      {Number(item.amount_usd).toFixed(2)}$
                    </span>
                    {ended ? null : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => end(item.id)}
                        disabled={pending}
                      >
                        إنهاء
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
