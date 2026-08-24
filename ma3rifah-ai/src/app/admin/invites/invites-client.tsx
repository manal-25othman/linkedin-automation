'use client';

import { useState, useTransition } from 'react';
import { Check, Copy, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/states';
import { formatDate } from '@/lib/utils';
import { createInviteCodeAction, revokeInviteCodeAction } from '@/app/admin/actions';

interface Invite {
  id: string;
  code: string;
  label: string;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  revoked_at: string | null;
  note: string | null;
  created_at: string;
  is_active: boolean;
}

/**
 * إصدار الدعوات وإلغاؤها.
 *
 * والرابط الجاهز هو ما يُرسَل فعلًا: `/register?code=…` يملأ الحقل عن
 * المدعوّ فيقلّ خطأ النسخ. وهو تسهيلٌ لا ثغرة — التحقّق من الرمز يجري
 * على الخادم في كل الأحوال، فرابطٌ برمزٍ ملغى لا يفتح شيئًا.
 */
export function InvitesClient({ invites }: { invites: Invite[] }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [maxUses, setMaxUses] = useState('1');
  const [days, setDays] = useState('30');

  const origin = typeof window === 'undefined' ? '' : window.location.origin;

  const create = () => {
    startTransition(async () => {
      const result = await createInviteCodeAction({
        label,
        maxUses: Number(maxUses),
        expiresInDays: Number(days),
      });
      setMessage({ ok: result.ok, text: result.message ?? '' });
      if (result.ok) setLabel('');
    });
  };

  const revoke = (id: string) => {
    startTransition(async () => {
      const result = await revokeInviteCodeAction(id);
      setMessage({ ok: result.ok, text: result.message ?? '' });
    });
  };

  const copyLink = async (code: string) => {
    try {
      await navigator.clipboard.writeText(`${origin}/register?code=${encodeURIComponent(code)}`);
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setMessage({ ok: false, text: 'تعذّر النسخ. انسخي الرمز يدويًا.' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>إصدار دعوة</CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <Label htmlFor="invite-label">لمن؟</Label>
            <Input
              id="invite-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="شركة الأفق للاستشارات"
              className="mt-1"
            />
          </div>
          <div className="w-28">
            <Label htmlFor="invite-uses">الاستعمالات</Label>
            <Input
              id="invite-uses"
              type="number"
              min={1}
              max={500}
              value={maxUses}
              onChange={(event) => setMaxUses(event.target.value)}
              className="mt-1"
            />
          </div>
          <div className="w-28">
            <Label htmlFor="invite-days">صالح (يوم)</Label>
            <Input
              id="invite-days"
              type="number"
              min={1}
              value={days}
              onChange={(event) => setDays(event.target.value)}
              className="mt-1"
            />
          </div>
          <Button onClick={create} disabled={pending || !label.trim()}>
            <Plus className="size-4" aria-hidden />
            إصدار
          </Button>
        </div>

        {message ? (
          <p
            className={
              message.ok ? 'text-sm text-[hsl(var(--success))]' : 'text-sm text-destructive'
            }
            role="status"
          >
            {message.text}
          </p>
        ) : null}

        {invites.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="لا دعوات بعد"
            description="أصدري رمزًا لكل شركة مجرِّبة، فتعرفين من أين جاء كل حساب."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-start font-medium">الرمز</th>
                  <th className="px-3 py-2.5 text-start font-medium">لمن</th>
                  <th className="px-3 py-2.5 text-start font-medium">الاستعمال</th>
                  <th className="px-3 py-2.5 text-start font-medium">ينتهي</th>
                  <th className="px-3 py-2.5 text-start font-medium">الحالة</th>
                  <th className="px-3 py-2.5 text-start font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {invites.map((invite) => (
                  <tr key={invite.id}>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => copyLink(invite.code)}
                        title="نسخ رابط التسجيل"
                        className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1 font-mono text-xs transition-colors hover:border-primary/40"
                        dir="ltr"
                      >
                        {invite.code}
                        {copied === invite.code ? (
                          <Check className="size-3 text-[hsl(var(--success))]" aria-hidden />
                        ) : (
                          <Copy className="size-3 text-muted-foreground" aria-hidden />
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-3">{invite.label}</td>
                    <td className="numeric px-3 py-3 text-muted-foreground">
                      {invite.used_count} / {invite.max_uses}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {invite.expires_at ? formatDate(invite.expires_at) : 'بلا انتهاء'}
                    </td>
                    <td className="px-3 py-3">
                      {invite.revoked_at ? (
                        <Badge variant="destructive">ملغى</Badge>
                      ) : invite.is_active ? (
                        <Badge variant="success">فعّال</Badge>
                      ) : (
                        <Badge variant="secondary">منتهٍ</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 text-end">
                      {invite.revoked_at ? null : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revoke(invite.id)}
                          disabled={pending}
                        >
                          إلغاء
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
