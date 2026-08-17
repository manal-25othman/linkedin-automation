import { describe, expect, it } from 'vitest';
import { classify, linkedInJobId } from '@/lib/job/fetch';
import { decodeEntities, extractJobPosting, htmlToText, trimJobText } from '@/lib/job/html';

describe('htmlToText', () => {
  it('يحذف السكربتات والأنماط ويحافظ على فواصل الأسطر', () => {
    const html =
      '<div><script>alert(1)</script><style>.a{}</style><p>الفقرة الأولى</p><p>الثانية</p></div>';
    const text = htmlToText(html);
    expect(text).not.toContain('alert');
    expect(text).not.toContain('.a{');
    expect(text.split('\n')).toEqual(['الفقرة الأولى', 'الثانية']);
  });

  it('يحوّل عناصر القائمة إلى نقاط', () => {
    expect(htmlToText('<ul><li>أولى</li><li>ثانية</li></ul>')).toBe('• أولى\n• ثانية');
  });
});

describe('decodeEntities', () => {
  it('يفكّ الكيانات المسمّاة والرقمية', () => {
    expect(decodeEntities('&lt;p&gt; &amp; &#1575;&#1604;&#1593;&#1585;&#1576;')).toBe(
      '<p> & العرب',
    );
  });
});

describe('extractJobPosting', () => {
  const html = `<html><head>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting",
       "title":"مهندس برمجيات أول",
       "hiringOrganization":{"@type":"Organization","name":"شركة المثال"},
       "jobLocation":{"@type":"Place","address":{"addressLocality":"الرياض","addressCountry":"SA"}},
       "employmentType":"FULL_TIME",
       "description":"<p>نبحث عن مهندس خبرة خمس سنوات في TypeScript و Node.js لبناء خدمات مصغّرة.</p><ul><li>خبرة في AWS</li></ul>"}
    </script></head><body>محتوى الصفحة</body></html>`;

  it('يستخرج الحقول المهيكلة ويحوّل الوصف إلى نص', () => {
    const job = extractJobPosting(html);
    expect(job?.title).toBe('مهندس برمجيات أول');
    expect(job?.company).toBe('شركة المثال');
    expect(job?.location).toBe('الرياض، SA');
    expect(job?.employmentType).toBe('FULL_TIME');
    expect(job?.description).toContain('TypeScript');
    expect(job?.description).toContain('• خبرة في AWS');
  });

  it('يتجاهل JSON-LD التالف بدل إسقاط الصفحة كلها', () => {
    const broken = `<script type="application/ld+json">{ليس JSON}</script>${html}`;
    expect(extractJobPosting(broken)?.title).toBe('مهندس برمجيات أول');
  });

  it('يبحث داخل @graph', () => {
    const graph = `<script type="application/ld+json">
      {"@graph":[{"@type":"WebPage"},{"@type":"JobPosting","title":"محلل بيانات",
      "description":"وصف طويل بما يكفي ليتجاوز الحد الأدنى المطلوب في المُستخرِج، ويحتوي متطلبات."}]}
    </script>`;
    expect(extractJobPosting(graph)?.title).toBe('محلل بيانات');
  });

  it('يُرجع null حين لا توجد بيانات وظيفة', () => {
    expect(extractJobPosting('<html><body>لا شيء</body></html>')).toBeNull();
  });
});

describe('linkedInJobId', () => {
  it('يقرأ المعرّف من مسار العرض', () => {
    expect(linkedInJobId('https://www.linkedin.com/jobs/view/3912345678/')).toBe('3912345678');
    expect(
      linkedInJobId('https://www.linkedin.com/jobs/view/senior-engineer-at-acme-3912345678'),
    ).toBe('3912345678');
  });

  it('يقرأ المعرّف من معامل currentJobId', () => {
    expect(
      linkedInJobId('https://www.linkedin.com/jobs/search/?currentJobId=3912345678&keywords=x'),
    ).toBe('3912345678');
  });

  it('يُرجع null لغير روابط الوظائف', () => {
    expect(linkedInJobId('https://example.com/careers/123')).toBeNull();
    expect(linkedInJobId('ليس رابطًا')).toBeNull();
  });
});

describe('trimJobText', () => {
  it('يقصّ النص الطويل ويُعلم بذلك', () => {
    const trimmed = trimJobText('ا'.repeat(30_000));
    expect(trimmed.length).toBeLessThan(30_000);
    expect(trimmed).toContain('قُصّ النص');
  });

  it('يترك النص القصير كما هو', () => {
    expect(trimJobText('وصف قصير')).toBe('وصف قصير');
  });
});

describe('classify', () => {
  const page = (status: number, body = '') => ({
    finalUrl: 'https://example.com/job',
    status,
    body,
    contentType: 'text/html',
  });

  it('يميّز الصفحة غير الموجودة عن المنع', () => {
    expect(classify(page(404))).toBe('not-found');
    expect(classify(page(410))).toBe('not-found');
  });

  it('يعدّ رموز المنع منعًا، ومنها 999 الخاص بلينكدإن', () => {
    for (const status of [401, 403, 429, 999]) {
      expect(classify(page(status)), String(status)).toBe('blocked');
    }
  });

  it('يعدّ جدار تسجيل الدخول منعًا رغم رمز 200', () => {
    expect(classify(page(200, '<html><body>Please log in to continue</body></html>'))).toBe(
      'blocked',
    );
    expect(classify(page(200, '<div class="authwall">…</div>'))).toBe('blocked');
  });

  it('يعدّ بقية الأخطاء فشلًا لا منعًا', () => {
    expect(classify(page(500))).toBe('failed');
    expect(classify(page(503))).toBe('failed');
  });

  it('يمرّر الصفحة السليمة', () => {
    expect(classify(page(200, '<html><body>وصف الوظيفة</body></html>'))).toBe('ok');
  });
});
