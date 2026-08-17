import 'server-only';

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { isRtlText, parseCv, type CvBlock } from '@/lib/cv-format';

/**
 * توليد ملف Word من السيرة النصّية.
 *
 * الاتجاه ليس تفصيلًا تجميليًا هنا: مستند عربي بلا bidirectional على الفقرة
 * وrightToLeft على النص يفتح في Word بمحاذاة يسار وعلامات ترقيم في غير
 * مواضعها — يبدو الملف معطوبًا وإن كان النص سليمًا.
 */

const BULLET_REFERENCE = 'cv-bullets';

function runsFor(text: string, rtl: boolean, options: { bold?: boolean; size?: number; color?: string } = {}) {
  return [
    new TextRun({
      text,
      rightToLeft: rtl,
      bold: options.bold,
      size: options.size,
      color: options.color,
      font: rtl ? 'Arial' : 'Calibri',
    }),
  ];
}

function paragraphFor(block: CvBlock, rtl: boolean): Paragraph {
  const alignment = rtl ? AlignmentType.RIGHT : AlignmentType.LEFT;

  switch (block.type) {
    case 'name':
      return new Paragraph({
        bidirectional: rtl,
        alignment,
        spacing: { after: 60 },
        children: runsFor(block.text, rtl, { bold: true, size: 36 }),
      });

    case 'contact':
      return new Paragraph({
        bidirectional: rtl,
        alignment,
        spacing: { after: 240 },
        children: runsFor(block.text, rtl, { size: 20, color: '555555' }),
      });

    case 'heading':
      return new Paragraph({
        bidirectional: rtl,
        alignment,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 280, after: 120 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 4 },
        },
        children: runsFor(block.text.toUpperCase(), rtl, { bold: true, size: 24 }),
      });

    case 'subheading':
      return new Paragraph({
        bidirectional: rtl,
        alignment,
        spacing: { before: 160, after: 60 },
        children: runsFor(block.text, rtl, { bold: true, size: 22 }),
      });

    case 'bullet':
      return new Paragraph({
        bidirectional: rtl,
        alignment,
        numbering: { reference: BULLET_REFERENCE, level: 0 },
        spacing: { after: 60 },
        children: runsFor(block.text, rtl, { size: 22 }),
      });

    default:
      return new Paragraph({
        bidirectional: rtl,
        alignment,
        spacing: { after: 120 },
        children: runsFor(block.text, rtl, { size: 22 }),
      });
  }
}

export async function buildCvDocx(cvText: string): Promise<Buffer> {
  const blocks = parseCv(cvText);
  const rtl = isRtlText(cvText);

  const document = new Document({
    numbering: {
      config: [
        {
          reference: BULLET_REFERENCE,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: rtl ? { right: 360, hanging: 200 } : { left: 360, hanging: 200 },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } },
        },
        children: blocks.map((block) => paragraphFor(block, rtl)),
      },
    ],
  });

  return Packer.toBuffer(document);
}
