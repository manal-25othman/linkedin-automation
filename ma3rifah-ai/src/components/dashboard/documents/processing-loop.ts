'use client';

import {
  continueProcessingAction,
  type ActionResult,
} from '@/app/(dashboard)/documents/actions';

/**
 * حلقة متابعة القراءة الضوئية من المتصفح.
 *
 * الخادم يقرأ دفعة صفحات في كل نداء ويعود بـ`ocrPending` ما دامت هناك
 * صفحات؛ فيُعاد النداء حتى يكتمل. المتصفح هو المحرّك عمدًا: لا خوادم
 * دائمة تكمل العمل بعد الرد، وانقطاعه لا يضيع شيئًا — ما قُرئ مخزَّن.
 *
 * حدّ أعلى للدورات يحرس من حلقة لا تنتهي إن أعاد الخادم التقدم نفسه.
 */
const MAX_ROUNDS = 200;

export async function driveProcessing(
  first: ActionResult,
  onProgress: (done: number, total: number) => void,
): Promise<ActionResult> {
  let current = first;
  let rounds = 0;
  let lastDone = -1;
  let stalled = 0;

  while (current.ok && current.ocrPending && current.documentId && rounds < MAX_ROUNDS) {
    onProgress(current.ocrPending.done, current.ocrPending.total);

    // تقدّم لا يتحرك ثلاث مرات متتالية = شيء معطّل، لا ننتظره إلى الأبد
    if (current.ocrPending.done === lastDone) {
      stalled += 1;
      if (stalled >= 3) {
        return {
          ok: false,
          message: 'توقفت القراءة الضوئية دون تقدّم. أعد المحاولة من قائمة الخيارات بجانب المستند.',
        };
      }
    } else {
      stalled = 0;
      lastDone = current.ocrPending.done;
    }

    rounds += 1;
    current = await continueProcessingAction(current.documentId);
  }

  return current;
}
