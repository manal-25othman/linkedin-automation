import type { Metadata } from 'next';
import { requireCompanySession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shared/page-header';
import { SurveyForm } from './survey-form';

export const metadata: Metadata = { title: 'شاركنا رأيك' };
export const dynamic = 'force-dynamic';

/**
 * الاستبيان داخل المنصة.
 *
 * لا يُطلب اسم ولا بريد ولا شركة: كلها في الجلسة. وإجابة المستخدم
 * السابقة تُعرض له ليعدّلها — سياسة القراءة تحصر الجدول في صاحبها.
 */
export default async function FeedbackPage() {
  await requireCompanySession();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('feedback_surveys')
    .select('overall_rating, found_answers, recommend_rating, most_useful, missing, allow_contact')
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="شاركنا رأيك — دقيقتان"
        description="خمسة أسئلة قصيرة. لا نطلب اسمك ولا بريدك، وما تكتبه يصل إلى فريق المنصة مباشرة."
      />

      <div className="rounded-xl border bg-card p-6 sm:p-8">
        <SurveyForm
          alreadySubmitted={existing !== null}
          defaults={{
            overallRating: existing?.overall_rating ?? null,
            foundAnswers: existing?.found_answers ?? null,
            recommendRating: existing?.recommend_rating ?? null,
            mostUseful: existing?.most_useful ?? '',
            missing: existing?.missing ?? '',
            allowContact: existing?.allow_contact ?? false,
          }}
        />
      </div>
    </div>
  );
}
