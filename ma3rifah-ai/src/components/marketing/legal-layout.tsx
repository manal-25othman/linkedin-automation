import { AlertTriangle } from 'lucide-react';
import { IS_LEGAL_ENTITY_COMPLETE, LEGAL_ENTITY, LEGAL_LAST_UPDATED } from '@/lib/config/legal';

/**
 * إطار الوثائق القانونية.
 *
 * يعرض تنبيهًا ظاهرًا ما دامت بيانات الكيان ناقصة. والتنبيه مقصود ولا
 * يُخفى بحيلة تصميمية: وثيقة تدّعي الإلزام ولا تُعرّف الطرف المُلزَم
 * ليست وثيقة، وإخفاء نقصها يجعل الموقع يبدو جاهزًا وهو ليس كذلك.
 */
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">{intro}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        آخر تحديث: {LEGAL_LAST_UPDATED}
      </p>

      {!IS_LEGAL_ENTITY_COMPLETE ? (
        <div className="mt-8 flex items-start gap-3 rounded-lg border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-[hsl(var(--warning))]" aria-hidden />
          <div className="text-sm leading-relaxed">
            <p className="font-semibold">هذه الوثيقة مسوّدة غير مكتملة.</p>
            <p className="mt-1 text-muted-foreground">
              لم تُضبط بعدُ بيانات الكيان النظامي (الاسم، السجل التجاري، الرقم الضريبي، العنوان).
              اضبط متغيرات <code className="font-mono text-xs">NEXT_PUBLIC_LEGAL_*</code> قبل
              استقبال أي عميل، واعرض النص على مختص نظامي — فما هنا صياغة تقنية لا استشارة قانونية.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-8 rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed">
          <p className="font-medium">{LEGAL_ENTITY.name}</p>
          <dl className="mt-2 grid gap-x-6 gap-y-1 text-muted-foreground sm:grid-cols-2">
            <div className="flex gap-2">
              <dt>السجل التجاري:</dt>
              <dd dir="ltr">{LEGAL_ENTITY.registrationNumber}</dd>
            </div>
            {LEGAL_ENTITY.vatNumber ? (
              <div className="flex gap-2">
                <dt>الرقم الضريبي:</dt>
                <dd dir="ltr">{LEGAL_ENTITY.vatNumber}</dd>
              </div>
            ) : null}
            {LEGAL_ENTITY.address ? (
              <div className="flex gap-2">
                <dt>العنوان:</dt>
                <dd>{LEGAL_ENTITY.address}</dd>
              </div>
            ) : null}
            <div className="flex gap-2">
              <dt>البريد:</dt>
              <dd dir="ltr">{LEGAL_ENTITY.email}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="mt-10 space-y-8">{children}</div>
    </div>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
      <div className="mt-3 space-y-3 text-sm leading-loose text-muted-foreground">{children}</div>
    </section>
  );
}
