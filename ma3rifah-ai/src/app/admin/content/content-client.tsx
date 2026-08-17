'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SITE_TEXT, SITE_TEXT_PAGES, defaultSiteText } from '@/content/site-text';
import { saveSiteTextAction } from '../actions';

/**
 * محرِّر محتوى الموقع.
 *
 * يُبنى من سجلّ المحتوى آليًا، فإضافة محتوى جديد للتحرير لا تمسّ هذا
 * الملف. ويعرض نوعين: نصًّا مفردًا، وقائمة عناصر تُضاف وتُحذف.
 *
 * وقاعدته أن المحرِّرة ترى دائمًا **الفرق عن الأصل**: أي حقل مغيَّر
 * يُوسَم، وبجانبه زرّ يعيده. محرِّرٌ لا يُظهر ما غُيِّر يجعل المرء يخشى
 * الحفظ، لأنه لا يعرف ماذا سيتغيّر على الموقع.
 *
 * والقوائم تُحرَّر صفوفًا لا JSON: من ستستعمل هذا لا يلزمها أن تعرف ما
 * الأقواس المعقوفة، والقيمة تُسلسَل عند الإرسال في حقل مخفي.
 */

export interface EditableText {
  key: string;
  current: string;
}

type ListValue = Record<string, string>[];

function parseList(raw: string, fallback: ListValue): ListValue {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ListValue) : fallback;
  } catch {
    return fallback;
  }
}

export function ContentClient({ texts }: { texts: EditableText[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const defaults = useMemo(() => defaultSiteText(), []);

  const initial = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of texts) map[item.key] = item.current;
    return map;
  }, [texts]);

  const [values, setValues] = useState<Record<string, string>>(initial);

  const set = (key: string, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const isChanged = (key: string) =>
    (values[key] ?? '').trim() !== (defaults[key] ?? '').trim();

  const changedCount = Object.keys(SITE_TEXT).filter(isChanged).length;

  const reset = (key: string) => set(key, defaults[key] ?? '');

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
            ? 'كل المحتوى على صيغته الأصلية.'
            : `${changedCount} عنصرًا مختلفًا عن الأصل.`}
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
            <CardContent className="space-y-7">
              {keys.map((key) => {
                const entry = SITE_TEXT[key];
                const changed = isChanged(key);

                const header = (
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
                        إعادة الأصل
                      </button>
                    ) : null}
                  </div>
                );

                if (entry.kind === 'list') {
                  const items = parseList(values[key] ?? '[]', entry.value);

                  const write = (next: ListValue) => set(key, JSON.stringify(next));

                  return (
                    <div key={key} className="space-y-3">
                      {header}
                      {entry.hint ? (
                        <p className="text-xs text-muted-foreground">{entry.hint}</p>
                      ) : null}

                      {/* القيمة تُرسَل مُسلسَلة — المحرِّرة لا ترى JSON */}
                      <input type="hidden" name={`text:${key}`} value={values[key] ?? ''} />

                      <div className="space-y-3">
                        {items.map((item, index) => (
                          <div
                            key={index}
                            className="space-y-3 rounded-lg border bg-muted/20 p-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground">
                                العنصر {index + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => write(items.filter((_, i) => i !== index))}
                                className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                              >
                                <Trash2 className="size-3.5" aria-hidden />
                                حذف
                              </button>
                            </div>

                            {entry.fields.map((field) => (
                              <div key={field.name} className="space-y-1.5">
                                <Label className="text-xs">{field.label}</Label>
                                {field.multiline ? (
                                  <textarea
                                    rows={3}
                                    maxLength={2000}
                                    value={item[field.name] ?? ''}
                                    onChange={(event) =>
                                      write(
                                        items.map((row, i) =>
                                          i === index
                                            ? { ...row, [field.name]: event.target.value }
                                            : row,
                                        ),
                                      )
                                    }
                                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-loose shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  />
                                ) : (
                                  <Input
                                    maxLength={2000}
                                    value={item[field.name] ?? ''}
                                    onChange={(event) =>
                                      write(
                                        items.map((row, i) =>
                                          i === index
                                            ? { ...row, [field.name]: event.target.value }
                                            : row,
                                        ),
                                      )
                                    }
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          write([
                            ...items,
                            Object.fromEntries(entry.fields.map((f) => [f.name, ''])),
                          ])
                        }
                      >
                        <Plus className="size-4" aria-hidden />
                        إضافة عنصر
                      </Button>
                    </div>
                  );
                }

                return (
                  <div key={key} className="space-y-2">
                    {header}

                    {entry.multiline ? (
                      <textarea
                        id={key}
                        name={`text:${key}`}
                        rows={3}
                        maxLength={5000}
                        value={values[key] ?? ''}
                        onChange={(event) => set(key, event.target.value)}
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
                        onChange={(event) => set(key, event.target.value)}
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
