import { ArrowLeft, Building2, Database, FileLock2, ScrollText } from 'lucide-react';

const ICONS = [Building2, Database, FileLock2, ScrollText];

/**
 * مسار الطلب.
 *
 * كان الأمان أربع بطاقات متجاورة، تُقرأ قائمةَ مزايا. والقائمة تقول
 * «عندنا هذا» ولا تقول **متى يقع**.
 *
 * والترتيب هو الحجّة هنا: الصلاحية تُفحص قبل بناء السياق لا بعده،
 * والعزل في القاعدة لا في الشيفرة. فرسمُ التسلسل يقول ما لا تقوله
 * البطاقات مهما أُحسنت صياغتها.
 *
 * ولا صورة ولا مكتبة رسم: حدودٌ وأسهم من المكوّنات نفسها، فلا وزن
 * يُضاف ولا لون يخرج عن السمة.
 */

export interface SecurityStage {
  stage: string;
  detail: string;
}

export function SecurityFlow({ stages }: { stages: SecurityStage[] }) {
  if (stages.length === 0) return null;

  return (
    <ol className="mt-10 space-y-3">
      {stages.map((item, index) => {
        const Icon = ICONS[index % ICONS.length];
        const last = index === stages.length - 1;

        return (
          <li key={item.stage} className="relative">
            <div className="flex items-start gap-4 rounded-xl border bg-card p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-xs font-semibold tabular-nums text-muted-foreground"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <h3 className="text-sm font-semibold">{item.stage}</h3>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {item.detail}
                </p>
              </div>
            </div>

            {/* السهم بين المرحلتين — يدور في RTL مع الاتجاه تلقائيًّا
                لأنه أيقونةٌ مقلوبة أصلًا، ويُخفى بعد الأخيرة */}
            {last ? null : (
              <span
                className="flex justify-center py-1 text-muted-foreground/50"
                aria-hidden
              >
                <ArrowLeft className="size-4 -rotate-90" />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
