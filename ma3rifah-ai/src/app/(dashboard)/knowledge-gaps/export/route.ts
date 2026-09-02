import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'مفتوحة',
  IN_REVIEW: 'قيد المراجعة',
  RESOLVED: 'معالَجة',
  DISMISSED: 'متجاهَلة',
};

/**
 * تصدير فجوات المعرفة إلى Excel — لمدير الشركة.
 *
 * بصلاحية العرض لا الإدارة: من يرى الفجوات في الصفحة يصدّرها — التصدير عرضٌ بصيغة أخرى.
 *
 * طلبها أول مجرّب حقيقي: قائمة الفجوات تُراجَع أسهل في جدول يُفرز
 * ويُوزَّع على من سيكتب الأجوبة.
 *
 * الاستعلام بجلسة المستخدم فتحصره RLS في شركته — لا معامل شركة في
 * الطلب أصلًا، فلا شيء يُزوَّر.
 */
export async function GET() {
  try {
    await requirePermission('knowledge_gaps.view');
  } catch {
    return new NextResponse('غير مصرّح', { status: 403 });
  }

  try {
    const supabase = await createClient();
    const { data: gaps, error } = await supabase
      .from('knowledge_gaps')
      .select('question, times_asked, status, resolution_note, answer_text, first_asked_at, last_asked_at')
      .order('times_asked', { ascending: false })
      .limit(5000);

    if (error) {
      logger.error('تعذّر تصدير فجوات المعرفة', { reason: error.message });
      return new NextResponse('تعذّر توليد الملف', { status: 500 });
    }

    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();

    const sheet = XLSX.utils.json_to_sheet(
      (gaps ?? []).map((row) => ({
        'السؤال': row.question,
        'مرات السؤال': row.times_asked,
        'الحالة': STATUS_LABELS[row.status] ?? row.status,
        'الإجابة المعتمدة': row.answer_text ?? '—',
        'ملاحظة المعالجة': row.resolution_note ?? '—',
        'أول سؤال': row.first_asked_at ? row.first_asked_at.slice(0, 10) : '—',
        'آخر سؤال': row.last_asked_at ? row.last_asked_at.slice(0, 10) : '—',
      })),
    );
    sheet['!cols'] = [
      { wch: 60 }, { wch: 11 }, { wch: 13 }, { wch: 60 }, { wch: 40 },
      { wch: 12 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(workbook, sheet, 'فجوات المعرفة');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="knowledge-gaps-${stamp}.xlsx"`,
      },
    });
  } catch (error) {
    logger.error('تعذّر تصدير فجوات المعرفة', {
      reason: error instanceof Error ? error.message : String(error),
    });
    return new NextResponse('تعذّر توليد الملف', { status: 500 });
  }
}
