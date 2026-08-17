'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SITE_TEXT, SITE_TEXT_PAGES } from '@/content/site-text';
import { saveSiteTextAction } from '../actions';

/**
 * محرِّر نصوص الموقع.
 *
 * يُبنى من سجلّ النصوص آليًا، فإضافة نصّ جديد للتحرير لا تمسّ هذا الملف.
 *
 * وقاعدته أن المحرِّرة ترى دائمًا **الفرق عن الأصل**: أي حقل مغيَّر
 * يُوسَم، وبجانبه زرّ يعيده. محرِّرٌ لا يُظهر ما غُيِّر يجعل المرء يخشى
 * الحفظ، لأنه لا يعرف ماذا سيتغيّر على الموقع.
 */

export interface EditableText {
  key: string;
  current: string;
}

export function ContentClient({ texts }: { texts: EditableText[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const initial = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of texts) map[item.key] = item.current;
    return map;
  }, [texts]);

  const [values, setValues] = useState<Record<string, string>>(initial);

  const isChanged = (key: string) => (values[key] ?? '').trim() !== SITE_TEXT[key].value.trim();
  const changedCount = Object.keys(SITE_TEXT).filter(isChanged).length;

  const reset = (key: string) =>
    setValues((current) => ({ ...current, [key]: SITE_TEXT[key].value }));

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const result = await saveSiteTextAction(formData);
      toast[result.ok ? 'success' : 'error'](result.message ?? 'تعذّر الحفظ.');
      if (result.ok) router.refresh();
    });
  };

  return (
    <form action={submit} className="space-y-6">
      <div className="sticky top-16 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/95 p-3 backdrop-blur">
        <p className="text-sm text-muted-foreground">
          {changedCount === 0
            ? 'كل النصوص على صيغتها الأصلية.'
            : `${changedCount} نصًّا مختلفًا عن الأصل.`}
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <a href="/" target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" aria-hidden />
              معاينة الموقع
            </a>
          </Button>
          <Button type="submit" loading={isPending}>
            <Save className="size-4" aria-hidden />
            حفظ ونشر
          </Button>
        </div>
      </div>

      {SITE_TEXT_PAGES.map((page) => {
        const keys = Object.keys(SITE_TEXT).filter((key) => SITE_TEXT[key].page === page);
        if (keys.length === 0) return null;

        return (
          <Card key={page}>
            <CardHeader>
              <CardTitle>{page}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {keys.map((key) => {
                const entry = SITE_TEXT[key];
                const changed = isChanged(key);

                return (
                  <div key={key} className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label htmlFor={key} className="flex items-center gap-2">
                        {entry.label}
                        {changed ? <Badge variant="warning">مُعدَّل</Badge> : null}
                      </Label>

                      {changed ? (
                        <button
                          type="button"
                          onClick={() => reset(key)}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <RotateCcw className="size-3.5" aria-hidden />
                          إعادة النصّ الأصلي
                        </button>
                      ) : null}
                    </div>

                    {entry.multiline ? (
                      <textarea
                        id={key}
                        name={`text:${key}`}
                        rows={3}
                        maxLength={5000}
                        value={values[key] ?? ''}
                        onChange={(event) =>
                          setValues((current) => ({ ...current, [key]: event.target.value }))
                        }
                        className={cn(
                          'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-loose shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          changed && 'border-[hsl(var(--warning))]/60',
                        )}
                      />
                    ) : (
                      <Input
                        id={key}
                        name={`text:${key}`}
                        maxLength={5000}
                        value={values[key] ?? ''}
                        onChange={(event) =>
                          setValues((current) => ({ ...current, [key]: event.target.value }))
                        }
                        className={cn(changed && 'border-[hsl(var(--warning))]/60')}
                      />
                    )}

                    {entry.hint ? (
                      <p className="text-xs text-muted-foreground">{entry.hint}</p>
                    ) : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      <p className="text-xs leading-relaxed text-muted-foreground">
        إفراغ أي حقل يعيده إلى نصّه الأصلي — لا يجعله فارغًا على الموقع. ونصٌّ فارغ في
        صفحة عامة عطبٌ ظاهر، فالإفراغ يُقرأ تراجعًا لا حذفًا.
      </p>
    </form>
  );
}
