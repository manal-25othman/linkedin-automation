import * as z from 'zod/v4';

/**
 * مخططات المخرجات.
 *
 * تُمرَّر إلى الـ API عبر output_config.format فيلتزم النموذج بالبنية
 * حرفيًا، ثم تُتحقَّق مرة أخرى محليًا. لا قيود طول ولا أنماط داخل هذه
 * المخططات: المخرجات المهيكلة لا تدعمها، ووجودها يُفشل الطلب كاملًا.
 */

export const jobBriefSchema = z.object({
  jobTitle: z.string().describe('المسمّى الوظيفي كما ورد في الإعلان'),
  company: z.string().describe('اسم جهة التوظيف، أو «غير مذكور»'),
  location: z.string().describe('موقع العمل ونمطه: حضوري/عن بعد/هجين'),
  seniority: z.string().describe('مستوى الخبرة المطلوب: مبتدئ/متوسط/أول/قيادي'),
  employmentType: z.string().describe('دوام كامل/جزئي/عقد/تدريب'),
  roleSummary: z.string().describe('فقرة واحدة تلخّص جوهر الدور ومسؤولياته'),
  mustHave: z.array(z.string()).describe('المتطلبات الإلزامية كما وردت'),
  niceToHave: z.array(z.string()).describe('المتطلبات التفضيلية'),
  atsKeywords: z
    .array(z.string())
    .describe('الكلمات المفتاحية التي تفحصها أنظمة تتبّع المتقدمين'),
  applicationTips: z
    .array(
      z.object({
        title: z.string().describe('عنوان النصيحة في أربع كلمات أو أقل'),
        detail: z.string().describe('النصيحة مشروحة وقابلة للتنفيذ فورًا'),
      }),
    )
    .describe('نصائح التقديم على هذه الوظيفة تحديدًا، لا نصائح عامة'),
  cvSummaryDraft: z
    .string()
    .describe('مسودة الملخص المهني أعلى السيرة الذاتية، ٣ إلى ٤ أسطر'),
  linkedinAboutDraft: z.string().describe('مسودة قسم «حول» في لينكدإن'),
  recruiterMessage: z
    .string()
    .describe('رسالة قصيرة تُرسل لمسؤول التوظيف على لينكدإن، أقل من ٨٠ كلمة'),
  watchOuts: z
    .array(z.string())
    .describe('ملاحظات تستحق الانتباه في الإعلان: غموض، تناقض، شروط غير معتادة'),
});

export type JobBrief = z.infer<typeof jobBriefSchema>;

export const cvAnalysisSchema = z.object({
  matchScore: z.number().describe('درجة المطابقة من ٠ إلى ١٠٠'),
  verdict: z.string().describe('حكم من سطر واحد: هل يستحق التقديم وبأي شروط'),
  scoreBreakdown: z
    .array(
      z.object({
        label: z.string().describe('محور التقييم: الخبرة، المهارات التقنية، …'),
        score: z.number().describe('درجة هذا المحور من ١٠٠'),
        note: z.string().describe('سبب الدرجة في جملة'),
      }),
    )
    .describe('تفصيل الدرجة على محاور'),
  strengths: z.array(z.string()).describe('نقاط القوة المطابقة لمتطلبات الوظيفة'),
  gaps: z
    .array(
      z.object({
        gap: z.string().describe('الفجوة'),
        whyItMatters: z.string().describe('أثرها على فرص القبول'),
        howToFix: z.string().describe('ما يفعله المتقدّم الآن لسدّها أو الالتفاف عليها بصدق'),
      }),
    )
    .describe('الفجوات بين السيرة والمتطلبات'),
  missingKeywords: z
    .array(z.string())
    .describe('كلمات مفتاحية في الإعلان غائبة عن السيرة ويصحّ إضافتها'),
  atsIssues: z
    .array(z.string())
    .describe('مشاكل تعيق قراءة أنظمة التتبّع: جداول، أعمدة، صور، رؤوس غير قياسية'),
  sectionFeedback: z
    .array(
      z.object({
        section: z.string().describe('اسم القسم في السيرة'),
        issue: z.string().describe('الملاحظة'),
        suggestion: z.string().describe('التعديل المقترح'),
      }),
    )
    .describe('ملاحظات مفصّلة على أقسام السيرة'),
  tailoredSummary: z.string().describe('ملخص مهني مُفصَّل على هذه الوظيفة، من واقع خبرة المتقدّم'),
  quickWins: z.array(z.string()).describe('تعديلات سريعة عالية الأثر، مرتّبة بالأهمية'),
});

export type CvAnalysis = z.infer<typeof cvAnalysisSchema>;

export const cvRewriteSchema = z.object({
  language: z.enum(['ar', 'en']).describe('لغة السيرة المعدّلة'),
  improvedCv: z
    .string()
    .describe(
      'السيرة الذاتية كاملةً بعد التعديل. تنسيق نصّي بسيط: # للاسم، ## للأقسام، - للنقاط.',
    ),
  changes: z
    .array(
      z.object({
        area: z.string().describe('القسم أو السطر المعدَّل'),
        before: z.string().describe('النص قبل التعديل'),
        after: z.string().describe('النص بعد التعديل'),
        why: z.string().describe('سبب التعديل بربطه بمتطلب في الإعلان'),
      }),
    )
    .describe('أبرز التعديلات مشروحة'),
  coverLetter: z.string().describe('رسالة تقديم مخصّصة لهذه الوظيفة'),
  linkedinAbout: z.string().describe('قسم «حول» في لينكدإن بعد التحديث'),
  remainingAdvice: z
    .array(z.string())
    .describe('ما لا يستطيع التعديل حلّه ويحتاج فعلًا من المتقدّم'),
});

export type CvRewrite = z.infer<typeof cvRewriteSchema>;
