import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PageBody } from '../../src/components/marketing/page-body';

/**
 * عرض نصّ الصفحات المصنوعة — من الكتابة إلى HTML.
 *
 * اختبار المحلِّل وحده لا يكفي: المحلِّل قد يُعيد نصًّا سليمًا ثم يُحقن
 * العارض في الصفحة بلا هروب. والقياس هنا على المخرج النهائي — وهو
 * ما يصل المتصفح فعلًا — لا على بنية وسطى.
 */

function render(body: string): string {
  return renderToStaticMarkup(<PageBody body={body} />);
}

describe('عرض نصّ الصفحة', () => {
  it('الوسوم المكتوبة تخرج نصًّا مهروبًا لا وسمًا', () => {
    const html = render('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('صورة بحدث onerror لا تخرج وسمًا', () => {
    const html = render('<img src=x onerror="alert(1)">');
    // النصّ كلّه مهروب: `onerror=` يظهر حرفًا داخل نصّ ظاهر، لا سمةً على
    // وسم. والقياس على غياب الوسم لا على غياب الكلمة — الكلمة في متن
    // صفحةٍ تشرح الحقن مثلًا لا ضرر فيها.
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });

  it('الرابط المقبول يخرج وسم رابط', () => {
    const html = render('انظر [الأسعار](/pricing)');
    expect(html).toContain('href="/pricing"');
  });

  it('الرابط بمخطّط برمجيّ لا يخرج href إطلاقًا', () => {
    const html = render('[اضغط](javascript:alert)');
    expect(html).not.toContain('javascript');
    expect(html).toContain('اضغط');
  });

  it('الرابط الخارجي يحمل noreferrer', () => {
    const html = render('[موقع](https://example.com)');
    expect(html).toContain('rel="noreferrer nofollow"');
    expect(html).toContain('target="_blank"');
  });

  it('العنوان والقائمة والتعريض تخرج وسومها', () => {
    const html = render('## عنوان\n\n- أول\n- ثانٍ\n\nنصّ **عريض**');
    expect(html).toContain('<h2');
    expect(html).toContain('<ul');
    expect(html).toContain('<li');
    expect(html).toContain('<strong');
  });

  it('القائمة المرقّمة تخرج ol', () => {
    expect(render('1. أول\n2. ثانٍ')).toContain('<ol');
  });

  it('نصّ فارغ لا يخرج فقرة فارغة', () => {
    expect(render('')).not.toContain('<p');
  });
});
