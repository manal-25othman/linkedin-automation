'use client';

import * as React from 'react';
import { Link2, Sparkles } from 'lucide-react';
import { Button, Card, CardTitle, Field, Input, Textarea } from '@/components/ui/primitives';

export interface JobSubmission {
  url?: string;
  text?: string;
}

export function JobStep({
  loading,
  blockedMessage,
  onSubmit,
}: {
  loading: boolean;
  blockedMessage: string | null;
  onSubmit: (submission: JobSubmission) => void;
}) {
  const [url, setUrl] = React.useState('');
  const [text, setText] = React.useState('');

  // فتح حقل اللصق تلقائيًا حين يمنع الموقعُ القراءةَ: المستخدم لا يحتاج
  // أن يبحث عن الحل بعد أن أُخبر بالمشكلة.
  const [showPaste, setShowPaste] = React.useState(false);
  React.useEffect(() => {
    if (blockedMessage) setShowPaste(true);
  }, [blockedMessage]);

  const canSubmit = Boolean(url.trim() || text.trim().length >= 120);

  return (
    <Card>
      <CardTitle icon={<Link2 className="size-5 text-primary" />} hint="الخطوة ١ من ٣">
        رابط الوظيفة
      </CardTitle>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit || loading) return;
          onSubmit({ url: url.trim() || undefined, text: text.trim() || undefined });
        }}
      >
        <Field
          label="الصق رابط الإعلان"
          hint="لينكدإن، بيت، وظّفني، Greenhouse، Lever، أو موقع الشركة مباشرة."
        >
          <Input
            type="url"
            dir="ltr"
            placeholder="https://www.linkedin.com/jobs/view/..."
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            disabled={loading}
          />
        </Field>

        {blockedMessage && (
          <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            {blockedMessage}
          </p>
        )}

        {showPaste ? (
          <Field
            label="أو الصق نصّ الإعلان"
            hint="أدقّ خيار دائمًا: انسخ الإعلان كاملًا من الصفحة والصقه هنا."
          >
            <Textarea
              rows={9}
              placeholder="المسمّى الوظيفي، المسؤوليات، المتطلبات…"
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={loading}
            />
          </Field>
        ) : (
          <button
            type="button"
            className="text-sm text-primary underline-offset-4 hover:underline"
            onClick={() => setShowPaste(true)}
          >
            لا يوجد رابط؟ الصق نصّ الإعلان بدلًا منه
          </button>
        )}

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" size="lg" loading={loading} disabled={!canSubmit}>
            <Sparkles className="size-4" />
            حلّل الوظيفة
          </Button>
          {loading && (
            <span className="text-sm text-muted-foreground">
              يقرأ الإعلان ويستخرج النصائح…
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}
