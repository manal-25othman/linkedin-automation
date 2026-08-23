'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calculator, Clock, TrendingUp, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ROI_BOUNDS,
  ROI_DEFAULTS,
  type RoiInputs,
  computeRoi,
  formatSar,
} from '@/lib/roi';

/**
 * حاسبة العائد للزائر.
 *
 * قرار التصميم الأهم فيها: **كل افتراض ظاهر وقابل للتعديل**، ومنه
 * الافتراض الذي يخدمنا أقلّه — نسبة ما تجيب عنه المنصّة فعلًا.
 *
 * وأكثر حاسبات العائد تخفي هذا الافتراض وتضعه ١٠٠٪، فتُخرج رقمًا
 * مذهلًا لا يصدّقه مشترٍ جادّ. والمشتري الذي يرى الافتراض ويستطيع
 * تخفيضه بيده يصدّق الرقم الذي يخرج — لأنه صار رقمه هو.
 *
 * ولا يُخفى الجواب السالب: شركة صغيرة بأسئلة نادرة تُعرض عليها النتيجة
 * كما هي. وبيعُ اشتراك لمن لا يفيده يُنتج تسرّبًا بعد شهرين وسمعةً
 * أسوأ من صفقةٍ لم تتمّ.
 */

interface FieldProps {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}

function Field({ label, hint, value, min, max, step = 1, suffix, onChange }: FieldProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium">{label}</label>
        <span className="numeric text-sm font-semibold text-primary">
          {value}
          {suffix ? <span className="ms-1 text-xs font-normal">{suffix}</span> : null}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
        className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
      />

      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function RoiCalculator() {
  const [inputs, setInputs] = useState<RoiInputs>(ROI_DEFAULTS);
  const result = useMemo(() => computeRoi(inputs), [inputs]);

  const set = <K extends keyof RoiInputs>(key: K) => (value: number) =>
    setInputs((current) => ({ ...current, [key]: value }));

  const worthIt = result.netSar !== null && result.netSar > 0;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* المدخلات */}
        <div className="rounded-2xl border bg-card p-6 sm:p-7">
          <div className="flex items-center gap-2">
            <Calculator className="size-4 text-primary" aria-hidden />
            <h3 className="text-base font-semibold">أرقام شركتك</h3>
          </div>

          <div className="mt-6 space-y-5">
            <Field
              label="عدد الموظفين"
              value={inputs.employees}
              min={ROI_BOUNDS.employees.min}
              max={300}
              onChange={set('employees')}
            />
            <Field
              label="أسئلة متكرّرة لكل موظف أسبوعيًا"
              hint="السؤال الذي جوابه مكتوب في لوائحكم أصلًا"
              value={inputs.questionsPerWeek}
              min={0}
              max={10}
              step={0.5}
              onChange={set('questionsPerWeek')}
            />
            <Field
              label="الدقائق الضائعة على السؤال الواحد"
              hint="وقت السائل والمجيب معًا — البحث والانتظار والشرح"
              value={inputs.minutesPerQuestion}
              min={ROI_BOUNDS.minutesPerQuestion.min}
              max={60}
              suffix="دقيقة"
              onChange={set('minutesPerQuestion')}
            />
            <Field
              label="تكلفة ساعة العمل"
              value={inputs.hourlyCostSar}
              min={ROI_BOUNDS.hourlyCostSar.min}
              max={400}
              step={5}
              suffix="ريال"
              onChange={set('hourlyCostSar')}
            />

            <div className="border-t pt-5">
              <Field
                label="كم تجيب عنه المنصّة فعلًا"
                hint="لا يُجاب عن كل سؤال: بعضه لا أصل له في مستنداتكم، وبعضه يحتاج حكمًا بشريًا. خفّضيه كما تشائين."
                value={Math.round(inputs.answerRate * 100)}
                min={10}
                max={100}
                step={5}
                suffix="٪"
                onChange={(value) => set('answerRate')(value / 100)}
              />
            </div>
          </div>
        </div>

        {/* النتيجة */}
        <div className="rounded-2xl border bg-muted/30 p-6 sm:p-7">
          <h3 className="text-base font-semibold">النتيجة الشهرية</h3>

          <dl className="mt-6 space-y-4">
            <div className="flex items-center justify-between gap-3 border-b pb-4">
              <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="size-4" aria-hidden />
                ساعات مستردَّة
              </dt>
              <dd className="numeric text-xl font-bold">{result.hoursSavedPerMonth}</dd>
            </div>

            <div className="flex items-center justify-between gap-3 border-b pb-4">
              <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="size-4" aria-hidden />
                قيمتها بالريال
              </dt>
              <dd className="numeric text-xl font-bold">{formatSar(result.savedSar)}</dd>
            </div>

            <div className="flex items-center justify-between gap-3 border-b pb-4">
              <dt className="text-sm text-muted-foreground">
                الخطة المناسبة
                <span className="mt-0.5 block text-xs">
                  تكفي {inputs.employees} موظفًا و
                  <span className="numeric">{result.answeredPerMonth}</span> سؤالًا
                </span>
              </dt>
              <dd className="text-end">
                <span className="font-semibold">{result.plan.name}</span>
                <span className="numeric mt-0.5 block text-sm text-muted-foreground">
                  {result.planCostSar === null
                    ? 'حسب الطلب'
                    : `${formatSar(result.planCostSar)} ريال`}
                </span>
              </dd>
            </div>

            {result.netSar !== null ? (
              <div
                className={cn(
                  'rounded-xl p-4',
                  worthIt
                    ? 'bg-[hsl(var(--success))]/10'
                    : 'bg-[hsl(var(--warning))]/10',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-sm font-medium">
                    <TrendingUp className="size-4" aria-hidden />
                    {worthIt ? 'الوفر الصافي' : 'الفرق'}
                  </dt>
                  <dd
                    className={cn(
                      'numeric text-2xl font-bold',
                      worthIt
                        ? 'text-[hsl(var(--success))]'
                        : 'text-[hsl(var(--warning))]',
                    )}
                  >
                    {formatSar(result.netSar)}
                  </dd>
                </div>

                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {worthIt ? (
                    <>
                      يعود <span className="numeric font-semibold">{result.ratio}</span> ريالًا
                      مقابل كل ريال، ويغطّي الاشتراكَ وفرُ{' '}
                      <span className="numeric font-semibold">{result.paybackDays}</span> يومًا.
                    </>
                  ) : (
                    <>
                      بهذه الأرقام لا يوفّر الاشتراك عليكم شيئًا — والأصدق أن نقولها.
                      جرّبي رفع عدد الأسئلة المتكرّرة إن كان تقديرك متحفّظًا، وإلّا
                      فالمنصّة ليست لكم الآن.
                    </>
                  )}
                </p>
              </div>
            ) : (
              <div className="rounded-xl bg-primary/5 p-4">
                <p className="text-sm leading-relaxed">
                  حجمكم يتجاوز الخطط المعلنة. خطة Enterprise تُبنى على قياسكم —
                  تواصلوا معنا للحساب الدقيق.
                </p>
              </div>
            )}
          </dl>

          <Button asChild className="mt-6 w-full">
            <Link href={result.planCostSar === null ? '/contact' : '/register'}>
              {result.planCostSar === null ? 'تواصلوا معنا' : 'ابدأ التجربة — ١٤ يومًا بلا بطاقة'}
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>

      {/* المعادلة معروضة — لا صندوق أسود */}
      <details className="mt-6 rounded-xl border bg-card p-5">
        <summary className="cursor-pointer text-sm font-medium">
          كيف حُسب هذا الرقم؟
        </summary>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p className="numeric rounded-lg bg-muted/50 p-3 text-xs" dir="ltr">
            ({inputs.employees} موظفًا × {inputs.questionsPerWeek} سؤالًا أسبوعيًا × 4.33
            أسبوعًا) × {Math.round(inputs.answerRate * 100)}٪ ×{' '}
            {inputs.minutesPerQuestion} دقيقة ÷ 60 = {result.hoursSavedPerMonth} ساعة
          </p>
          <p>
            <strong className="text-foreground">والساعة المستردَّة ليست ريالًا بذاتها.</strong>{' '}
            تصير قيمةً إذا استُعملت في عمل آخر — عميل يُخدم، أو مشروع يتقدّم، أو
            موظف جديد يُلحَق أسرع. ولذلك يُقرأ الرقم أعلاه سقفًا لما يمكن استرداده
            لا مبلغًا يُضاف إلى حسابكم البنكي.
          </p>
          <p>
            وكل رقم أعلاه تقديركم أنتم لا تقديرنا. وأدقّها يُعرف بعد أسبوعين من
            التجربة، إذ تُظهر لوحة التحليلات عدد الأسئلة الحقيقي وما أُجيب عنه فعلًا.
          </p>
        </div>
      </details>
    </div>
  );
}
