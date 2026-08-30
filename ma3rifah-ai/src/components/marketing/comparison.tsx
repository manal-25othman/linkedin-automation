import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * المقارنة.
 *
 * ليست جدولًا — الجدول على الهاتف يُضغط أو ينزلق أفقيًّا، وكلاهما
 * يُخفي نصف المقارنة عن نصف الزوّار.
 *
 * فبُنيت شبكةً تتحوّل: على الحاسب ثلاثة أعمدة برأسٍ واحد، وعلى الهاتف
 * بطاقةٌ لكل جانب تحمل الجانبين معًا. والمحتوى واحد في الحالتين.
 *
 * والعمود الأيمن — عمودنا — مرفوعٌ بحدٍّ وأرضٍ لا بلونٍ صارخ: المقارنة
 * التي تصرخ تُقرأ دعايةً، والمقارنة الهادئة تُقرأ حجّة.
 */

export interface ComparisonRow {
  aspect: string;
  generic: string;
  ours: string;
}

export function Comparison({ rows }: { rows: ComparisonRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="mt-14">
      {/* رأس الأعمدة — على الحاسب وحده، فالهاتف يحمل عنوانه في كل بطاقة */}
      <div className="hidden gap-4 px-6 pb-3 lg:grid lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,1fr)]">
        {/*
          خانةٌ فارغة لا `sr-only`.
          `sr-only` يجعل العنصر مطلق الموضع فيخرج من تدفّق الشبكة،
          فتنزلق التسميتان عمودًا وتصيران فوق العمود الخطأ — وهو ما
          وقع فعلًا وظهر في اللقطة.
        */}
        <span aria-hidden />
        <span className="text-sm font-medium text-muted-foreground">أداة عامة</span>
        <span className="text-sm font-semibold text-foreground">معرفة AI</span>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        {rows.map((row, index) => (
          <div
            key={row.aspect}
            className={cn(
              'grid gap-x-4 gap-y-3 p-6 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,1fr)] lg:items-start',
              index > 0 && 'border-t',
            )}
          >
            <h3 className="text-sm font-semibold leading-snug">{row.aspect}</h3>

            <Cell
              label="أداة عامة"
              text={row.generic}
              icon={<Minus className="size-3.5" aria-hidden />}
              muted
            />
            <Cell
              label="معرفة AI"
              text={row.ours}
              icon={<Check className="size-3.5" aria-hidden />}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Cell({
  label,
  text,
  icon,
  muted = false,
}: {
  label: string;
  text: string;
  icon: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl p-4 lg:bg-transparent lg:p-0',
        muted ? 'bg-muted/50' : 'bg-primary/5 lg:bg-transparent',
      )}
    >
      {/* التسمية للهاتف: بلا رأسٍ للأعمدة لا يُعرف أيّ نصٍّ لأيّهما */}
      <span
        className={cn(
          // تخفى بصريًّا على الحاسب وتبقى مقروءة للقارئ الصوتيّ:
          // رأس العمود وحده لا يربط الخانة بعنوانها برمجيًّا
          'mb-1.5 block text-xs font-medium lg:sr-only',
          muted ? 'text-muted-foreground' : 'text-primary',
        )}
      >
        {label}
      </span>
      <p
        className={cn(
          'flex items-start gap-2 text-sm leading-relaxed',
          muted ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        <span
          className={cn(
            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
            muted ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-primary',
          )}
        >
          {icon}
        </span>
        <span className="min-w-0">{text}</span>
      </p>
    </div>
  );
}
