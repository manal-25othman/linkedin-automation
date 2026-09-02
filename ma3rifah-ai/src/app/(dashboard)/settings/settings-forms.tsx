'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/misc';
import { STARTER_QUESTIONS_MAX } from '@/lib/validation/schemas';
import type { CompanyAiSettings } from '@/types/database';
import { updateAiSettingsAction, updateCompanyAction, updateProfileAction } from './actions';

type Action = (formData: FormData) => Promise<{ ok: boolean; message?: string }>;

function SettingsForm({
  action,
  children,
  submitLabel = 'حفظ التغييرات',
}: {
  action: Action;
  children: React.ReactNode;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (!result.ok) {
        setError(result.message ?? 'تعذّر الحفظ.');
        return;
      }
      toast.success(result.message ?? 'تم الحفظ.');
      router.refresh();
    });
  };

  return (
    <form action={submit} className="space-y-5">
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : null}

      {children}

      <Button type="submit" loading={isPending}>
        {submitLabel}
      </Button>
    </form>
  );
}

export function CompanyForm({
  name,
  industry,
}: {
  name: string;
  industry: string | null;
}) {
  return (
    <SettingsForm action={updateCompanyAction}>
      <div className="space-y-2">
        <Label htmlFor="name">اسم الشركة *</Label>
        <Input id="name" name="name" required defaultValue={name} maxLength={150} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="industry">القطاع</Label>
        <Input
          id="industry"
          name="industry"
          defaultValue={industry ?? ''}
          maxLength={100}
          placeholder="مثال: التقنية، التجزئة، الخدمات اللوجستية"
        />
      </div>
    </SettingsForm>
  );
}

export function ProfileForm({
  fullName,
  jobTitle,
  email,
}: {
  fullName: string;
  jobTitle: string | null;
  email: string;
}) {
  return (
    <SettingsForm action={updateProfileAction}>
      <div className="space-y-2">
        <Label htmlFor="fullName">الاسم الكامل *</Label>
        <Input id="fullName" name="fullName" required defaultValue={fullName} maxLength={120} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="jobTitle">المسمّى الوظيفي</Label>
        <Input id="jobTitle" name="jobTitle" defaultValue={jobTitle ?? ''} maxLength={120} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">البريد الإلكتروني</Label>
        <Input id="email" value={email} disabled dir="ltr" className="text-start" />
        <p className="text-xs text-muted-foreground">
          لتغيير البريد الإلكتروني تواصل مع مدير الشركة.
        </p>
      </div>
    </SettingsForm>
  );
}

export function AiSettingsForm({ settings }: { settings: CompanyAiSettings }) {
  const [topK, setTopK] = useState(settings.retrieval_top_k ?? 8);
  const [maxChunks, setMaxChunks] = useState(settings.max_context_chunks ?? 6);
  const [minSimilarity, setMinSimilarity] = useState(settings.min_similarity ?? 0.3);
  const [historyWindow, setHistoryWindow] = useState(settings.history_window ?? 6);

  return (
    <SettingsForm action={updateAiSettingsAction} submitLabel="حفظ إعدادات المساعد">
      <div className="space-y-2">
        <Label htmlFor="tone">أسلوب الإجابة</Label>
        <select
          id="tone"
          name="tone"
          defaultValue={settings.tone ?? 'professional'}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="professional">مهني رصين</option>
          <option value="friendly">ودود ومباشر</option>
          <option value="concise">مختصر جدًا</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="starter_questions">أسئلة البداية</Label>
        <Textarea
          id="starter_questions"
          name="starter_questions"
          rows={5}
          maxLength={2000}
          defaultValue={(settings.starter_questions ?? []).join('\n')}
          placeholder={'سطر لكل سؤال. مثال:\nكم عدد أيام الإجازة السنوية؟\nكيف أطلب سلفة على الراتب؟\nما إجراء تسليم العهدة عند الاستقالة؟'}
          dir="auto"
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          تظهر شرائحَ فوق صندوق المساعد حين يفتح الموظف محادثة جديدة، فيبدأ بنقرة بدل أن
          يحتار ماذا يسأل. اكتب أسئلة تعرف أن جوابها في مستنداتك — {STARTER_QUESTIONS_MAX}{' '}
          على الأكثر. اتركه فارغًا لتظهر أسئلة عامة افتراضية.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="retrieval_top_k">
          عدد المقاطع المسترجعة من قاعدة المعرفة: <span className="tabular-nums">{topK}</span>
        </Label>
        <input
          id="retrieval_top_k"
          name="retrieval_top_k"
          type="range"
          min={3}
          max={20}
          value={topK}
          onChange={(event) => setTopK(Number(event.target.value))}
          className="w-full accent-[hsl(var(--primary))]"
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          رقم أعلى يزيد فرصة العثور على المعلومة، ويزيد التكلفة قليلًا.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="max_context_chunks">
          المقاطع المُرسلة إلى النموذج: <span className="tabular-nums">{maxChunks}</span>
        </Label>
        <input
          id="max_context_chunks"
          name="max_context_chunks"
          type="range"
          min={2}
          max={12}
          value={maxChunks}
          onChange={(event) => setMaxChunks(Number(event.target.value))}
          className="w-full accent-[hsl(var(--primary))]"
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          أهم عامل في التكلفة. يجب ألا يتجاوز عدد المقاطع المسترجعة أعلاه.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="min_similarity">
          الحد الأدنى للتشابه:{' '}
          <span className="tabular-nums">{minSimilarity.toFixed(2)}</span>
        </Label>
        <input
          id="min_similarity"
          name="min_similarity"
          type="range"
          min={0.05}
          max={0.8}
          step={0.05}
          value={minSimilarity}
          onChange={(event) => setMinSimilarity(Number(event.target.value))}
          className="w-full accent-[hsl(var(--primary))]"
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          رفع القيمة يقلّل الإجابات المبنية على مصادر ضعيفة الصلة، لكنه يزيد عدد الأسئلة
          التي تُسجَّل كفجوات معرفة.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="history_window">
          رسائل المحادثة المُرسلة كسياق:{' '}
          <span className="tabular-nums">{historyWindow}</span>
        </Label>
        <input
          id="history_window"
          name="history_window"
          type="range"
          min={0}
          max={20}
          value={historyWindow}
          onChange={(event) => setHistoryWindow(Number(event.target.value))}
          className="w-full accent-[hsl(var(--primary))]"
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          صفر يعني معالجة كل سؤال باستقلال تام عن سابقه.
        </p>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
        <div className="min-w-0">
          <Label htmlFor="allow_general_knowledge">السماح بالمعرفة العامة</Label>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            عند التفعيل يجيب المساعد عن الأسئلة العامة غير المتعلقة بالشركة (كصياغة رسالة
            أو شرح مفهوم). أسئلة سياسات الشركة تبقى مقيّدة بمستنداتك في كل الأحوال.
          </p>
        </div>
        <Switch
          id="allow_general_knowledge"
          name="allow_general_knowledge"
          defaultChecked={settings.allow_general_knowledge}
        />
      </div>
    </SettingsForm>
  );
}
