import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { TICKET_STATUS_LABELS, TICKET_PRIORITY_LABELS } from '@/lib/config/support';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * تصدير تقرير المنصة إلى Excel.
 *
 * محصور بمالك المنصة: الملف يجمع بيانات كل الشركات في مكان واحد، وهو
 * أخطر تجميع في النظام. التحقق يسبق أي استعلام لا بعده.
 *
 * ولا يحوي الملف **محتوى** أي مستند ولا نص أي سؤال: أعدادًا وحالات
 * فقط. تقرير تشغيلي لا نسخة من معرفة العملاء.
 */
export async function GET() {
  try {
    await requireSuperAdmin();
  } catch {
    return new NextResponse('غير مصرّح', { status: 403 });
  }

  try {
    // التقرير يمرّ بجلسة المستخدم كي تتحقق الدالة من الدور مرة أخرى
    // داخل قاعدة البيانات — لا نكتفي بتحقق طبقة التطبيق.
    const supabase = await createClient();
    const { data: companies, error } = await supabase.rpc('platform_companies_report');

    if (error) {
      logger.error('تعذّر توليد تقرير المنصة', { reason: error.message });
      return new NextResponse('تعذّر توليد التقرير', { status: 500 });
    }

    const admin = createAdminClient();
    const [{ data: tickets }, { data: companyNames }] = await Promise.all([
      admin
        .from('support_tickets')
        .select('id, company_id, subject, category, status, priority, created_at, resolved_at')
        .order('created_at', { ascending: false })
        .limit(5000),
      admin.from('companies').select('id, name'),
    ]);

    const nameById = new Map((companyNames ?? []).map((row) => [row.id, row.name]));

    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();

    // --- الشركات ---
    const companiesSheet = XLSX.utils.json_to_sheet(
      (companies ?? []).map((row) => ({
        'الشركة': row.company_name,
        'الحالة': row.status,
        'تجريبية': row.is_demo ? 'نعم' : 'لا',
        'الخطة': row.plan_name ?? '—',
        'حالة الاشتراك': row.subscription_status ?? '—',
        'المستخدمون': row.users_count,
        'المستندات': row.documents_count,
        'الأسئلة': row.questions_count,
        'بلا إجابة': row.unanswered_count,
        'تذاكر مفتوحة': row.open_tickets,
        'آخر نشاط': row.last_activity_at ? row.last_activity_at.slice(0, 10) : '—',
        'تاريخ الإنشاء': row.created_at.slice(0, 10),
      })),
    );
    companiesSheet['!cols'] = [
      { wch: 28 }, { wch: 10 }, { wch: 9 }, { wch: 14 }, { wch: 14 },
      { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 11 }, { wch: 13 },
      { wch: 13 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(workbook, companiesSheet, 'الشركات');

    // --- التذاكر ---
    const ticketsSheet = XLSX.utils.json_to_sheet(
      (tickets ?? []).map((row) => ({
        'الشركة': nameById.get(row.company_id) ?? '—',
        'الموضوع': row.subject,
        'التصنيف': row.category ?? '—',
        'الحالة': TICKET_STATUS_LABELS[row.status] ?? row.status,
        'الأولوية': TICKET_PRIORITY_LABELS[row.priority] ?? row.priority,
        'فُتحت': row.created_at.slice(0, 10),
        'حُلّت': row.resolved_at ? row.resolved_at.slice(0, 10) : '—',
      })),
    );
    ticketsSheet['!cols'] = [
      { wch: 28 }, { wch: 50 }, { wch: 18 }, { wch: 13 }, { wch: 11 },
      { wch: 12 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(workbook, ticketsSheet, 'تذاكر الدعم');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const today = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="ma3rifah-report-${today}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logger.error('فشل تصدير تقرير المنصة', {
      reason: error instanceof Error ? error.message : String(error),
    });
    return new NextResponse('تعذّر توليد التقرير', { status: 500 });
  }
}
