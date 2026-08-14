'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input, Textarea } from '@/components/ui/input';
import { CrudDialog } from '@/components/dashboard/crud-dialog';
import { TICKET_CATEGORIES } from '@/lib/config/support';
import { createTicketAction } from './actions';

const SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function NewTicketButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        تذكرة جديدة
      </Button>

      <CrudDialog
        open={open}
        onOpenChange={setOpen}
        title="فتح تذكرة دعم"
        description="صف المشكلة بدقة: ما الذي فعلته، وما الذي توقّعته، وما الذي حدث."
        submitLabel="إرسال"
        action={async (formData) => {
          const result = await createTicketAction(formData);
          if (result.ok && result.ticketId) router.push(`/support/${result.ticketId}`);
          return result;
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="subject">الموضوع *</Label>
          <Input id="subject" name="subject" required minLength={4} maxLength={160} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="category">التصنيف</Label>
            <select id="category" name="category" className={SELECT_CLASS} defaultValue="">
              <option value="">بدون تصنيف</option>
              {TICKET_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">الأولوية</Label>
            <select id="priority" name="priority" className={SELECT_CLASS} defaultValue="NORMAL">
              <option value="LOW">منخفضة</option>
              <option value="NORMAL">عادية</option>
              <option value="HIGH">عالية</option>
              <option value="URGENT">عاجلة — العمل متوقف</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="body">تفاصيل المشكلة *</Label>
          <Textarea
            id="body"
            name="body"
            required
            rows={6}
            minLength={10}
            maxLength={4000}
            placeholder="مثال: رفعت ملف «لائحة الموارد البشرية.pdf» فظهرت حالته «فشل». الرسالة التي ظهرت: …"
          />
        </div>
      </CrudDialog>
    </>
  );
}
