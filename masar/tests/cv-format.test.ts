import { describe, expect, it } from 'vitest';
import { cvFileName, isRtlText, parseCv } from '@/lib/cv-format';

const SAMPLE = `# منال العارقي
manal@example.com | الرياض | +966500000000

## الخبرة العملية
### مهندسة برمجيات — شركة س
- بنت خدمة دفع خفّضت زمن المعالجة 40٪
- قادت فريقًا من ثلاثة مهندسين

## التعليم
بكالوريوس علوم حاسب`;

describe('parseCv', () => {
  it('يميّز الاسم وسطر التواصل والأقسام والنقاط', () => {
    const blocks = parseCv(SAMPLE);
    expect(blocks[0]).toEqual({ type: 'name', text: 'منال العارقي' });
    expect(blocks[1]?.type).toBe('contact');
    expect(blocks.filter((block) => block.type === 'heading')).toHaveLength(2);
    expect(blocks.filter((block) => block.type === 'bullet')).toHaveLength(2);
    expect(blocks.find((block) => block.type === 'subheading')?.text).toContain('مهندسة برمجيات');
  });

  it('يقبل علامات النقاط المختلفة ويزيل تشديد ماركداون', () => {
    const blocks = parseCv('* نقطة أولى\n• نقطة ثانية\n- **نقطة ثالثة**');
    expect(blocks).toHaveLength(3);
    expect(blocks.every((block) => block.type === 'bullet')).toBe(true);
    expect(blocks[2]?.text).toBe('نقطة ثالثة');
  });

  it('لا يعدّ سطرًا عاديًا بلا اسم سابق سطرَ تواصل', () => {
    const blocks = parseCv('نصّ حرّ بلا عنوان');
    expect(blocks[0]?.type).toBe('paragraph');
  });
});

describe('isRtlText', () => {
  it('يعدّ سيرة عربية فيها مصطلحات تقنية إنجليزية عربيةً', () => {
    expect(isRtlText('خبرة في React و TypeScript و Node.js لمدة 5 سنوات')).toBe(true);
  });

  it('يعدّ السيرة الإنجليزية إنجليزية', () => {
    expect(isRtlText('Senior Software Engineer with 5 years of experience')).toBe(false);
  });
});

describe('cvFileName', () => {
  it('يشتقّ الاسم ويستبدل المسافات', () => {
    expect(cvFileName(parseCv(SAMPLE), 'docx')).toBe('منال-العارقي.docx');
  });

  it('يسقط إلى اسم افتراضي حين لا اسم', () => {
    expect(cvFileName(parseCv('- نقطة'), 'docx')).toBe('cv.docx');
  });

  it('يحذف المحارف الممنوعة في أسماء الملفات', () => {
    expect(cvFileName(parseCv('# a/b:c*d'), 'docx')).toBe('abcd.docx');
  });
});
