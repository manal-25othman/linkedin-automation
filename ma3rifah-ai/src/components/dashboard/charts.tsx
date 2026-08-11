'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatNumber } from '@/lib/utils';

/**
 * ألوان السلاسل.
 *
 * ثابتة ومسندة بالترتيب (لا تُدوَّر): «مُجاب» تيل و«بلا إجابة» كهرماني.
 * تم التحقق منها آليًا على السطحين الفاتح والداكن: نطاق الإضاءة، أرضية
 * التشبّع، فصل عمى الألوان (ΔE ≈ 12.5 بروتان)، والتباين مقابل الخلفية.
 * اللون يتبع الكيان لا ترتيبه، فلا يتغيّر عند تصفية السلاسل.
 */
const SERIES = {
  answered: '#0D9488',
  unanswered: '#D5770B',
} as const;

const AXIS_TICK = { fontSize: 12, fill: 'hsl(var(--muted-foreground))' };
const GRID_COLOR = 'hsl(var(--border))';

function formatDay(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ar-SA', { day: 'numeric', month: 'short' }).format(date);
}

/* ------------------------------------------------------------------ Tooltip */

interface TooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  labelFormatter?: (value: string) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md">
      {label !== undefined ? (
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">
          {labelFormatter ? labelFormatter(String(label)) : String(label)}
        </p>
      ) : null}
      <ul className="space-y-1">
        {payload.map((item) => (
          <li key={String(item.dataKey)} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-muted-foreground">{item.name}</span>
            <span className="ms-auto font-medium tabular-nums text-foreground">
              {formatNumber(Number(item.value))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------- Legend */

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            aria-hidden
            className="size-2.5 rounded-[2px]"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------- جدول بديل لقارئات الشاشة */

function DataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {row.map((cell, cellIndex) =>
              cellIndex === 0 ? (
                <th key={cellIndex} scope="row">
                  {cell}
                </th>
              ) : (
                <td key={cellIndex}>{cell}</td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* --------------------------------------------- الأسئلة المُجابة عبر الزمن */

export interface TimeseriesPoint {
  day: string;
  total: number;
  answered: number;
  unanswered: number;
}

export function AnswerRateChart({ data }: { data: TimeseriesPoint[] }) {
  return (
    <div>
      <Legend
        items={[
          { label: 'مُجابة', color: SERIES.answered },
          { label: 'بلا إجابة', color: SERIES.unanswered },
        ]}
      />

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
            {/* الزمن يتدفق من اليمين إلى اليسار ليطابق اتجاه القراءة العربية */}
            <XAxis
              dataKey="day"
              reversed
              tickFormatter={formatDay}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: GRID_COLOR }}
              minTickGap={24}
            />
            <YAxis
              orientation="right"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={40}
            />
            <Tooltip
              content={<ChartTooltip labelFormatter={formatDay} />}
              cursor={{ stroke: GRID_COLOR, strokeWidth: 1 }}
            />
            <Line
              type="monotone"
              dataKey="answered"
              name="مُجابة"
              stroke={SERIES.answered}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
            />
            <Line
              type="monotone"
              dataKey="unanswered"
              name="بلا إجابة"
              stroke={SERIES.unanswered}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--background))' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <DataTable
        caption="الأسئلة المُجابة وغير المُجابة يوميًا"
        columns={['اليوم', 'مُجابة', 'بلا إجابة']}
        rows={data.map((point) => [formatDay(point.day), point.answered, point.unanswered])}
      />
    </div>
  );
}

/* ------------------------------------------------- الاستخدام حسب القسم */

export interface DepartmentUsagePoint {
  department_name: string;
  questions: number;
  active_users: number;
}

export function DepartmentUsageChart({ data }: { data: DepartmentUsagePoint[] }) {
  const rows = data.filter((row) => row.questions > 0);

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        لا يوجد نشاط مسجّل على مستوى الأقسام بعد.
      </p>
    );
  }

  // سلسلة واحدة ⇒ لون واحد وبلا مفتاح؛ العنوان يسمّي المقياس
  return (
    <div>
      <div className="w-full" style={{ height: Math.max(180, rows.length * 44) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
            barCategoryGap={10}
          >
            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              reversed
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="department_name"
              orientation="right"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={110}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.5 }}
            />
            <Bar
              dataKey="questions"
              name="الأسئلة"
              fill={SERIES.answered}
              radius={[4, 0, 0, 4]}
              maxBarSize={22}
            >
              {rows.map((row) => (
                <Cell key={row.department_name} fill={SERIES.answered} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <DataTable
        caption="عدد الأسئلة والمستخدمين النشطين حسب القسم"
        columns={['القسم', 'الأسئلة', 'مستخدمون نشطون']}
        rows={rows.map((row) => [row.department_name, row.questions, row.active_users])}
      />
    </div>
  );
}
