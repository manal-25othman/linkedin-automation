'use client';

import * as React from 'react';
import { isRtlText, parseCv, type CvBlock } from '@/lib/cv-format';

/** يعرض السيرة النصّية بشكل ورقة مقروءة */
export function CvSheet({ text }: { text: string }) {
  const blocks = React.useMemo(() => parseCv(text), [text]);
  const rtl = React.useMemo(() => isRtlText(text), [text]);

  return (
    <article
      dir={rtl ? 'rtl' : 'ltr'}
      className="cv-sheet rounded-md border border-border bg-card p-6 sm:p-8"
    >
      {renderBlocks(blocks)}
    </article>
  );
}

/**
 * تُجمَّع النقاط المتتالية في قائمة واحدة.
 *
 * عرض كل نقطة في <ul> مستقلّة يفصل بينها بمسافات ويكسر ترقيم قارئ الشاشة —
 * القائمة الواحدة هي التمثيل الصحيح دلاليًا.
 */
function renderBlocks(blocks: CvBlock[]): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];

  const flushBullets = (key: string) => {
    if (bulletBuffer.length === 0) return;
    nodes.push(
      <ul key={`ul-${key}`} className="my-2 list-disc space-y-1 pe-5">
        {bulletBuffer.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>,
    );
    bulletBuffer = [];
  };

  blocks.forEach((block, index) => {
    if (block.type === 'bullet') {
      bulletBuffer.push(block.text);
      return;
    }

    flushBullets(String(index));

    switch (block.type) {
      case 'name':
        nodes.push(<h1 key={index}>{block.text}</h1>);
        break;
      case 'contact':
        nodes.push(
          <p key={index} className="text-sm text-muted-foreground">
            {block.text}
          </p>,
        );
        break;
      case 'heading':
        nodes.push(<h2 key={index}>{block.text}</h2>);
        break;
      case 'subheading':
        nodes.push(<h3 key={index}>{block.text}</h3>);
        break;
      default:
        nodes.push(
          <p key={index} className="my-2">
            {block.text}
          </p>,
        );
    }
  });

  flushBullets('end');
  return nodes;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function blocksToHtml(blocks: CvBlock[]): string {
  const parts: string[] = [];
  let bullets: string[] = [];

  const flush = () => {
    if (bullets.length === 0) return;
    parts.push(`<ul>${bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`);
    bullets = [];
  };

  for (const block of blocks) {
    if (block.type === 'bullet') {
      bullets.push(block.text);
      continue;
    }
    flush();
    const text = escapeHtml(block.text);
    switch (block.type) {
      case 'name':
        parts.push(`<h1>${text}</h1>`);
        break;
      case 'contact':
        parts.push(`<p class="contact">${text}</p>`);
        break;
      case 'heading':
        parts.push(`<h2>${text}</h2>`);
        break;
      case 'subheading':
        parts.push(`<h3>${text}</h3>`);
        break;
      default:
        parts.push(`<p>${text}</p>`);
    }
  }

  flush();
  return parts.join('\n');
}

/**
 * طباعة السيرة (ومنها «حفظ كـ PDF»).
 *
 * التوليد يمرّ بمحرّك الطباعة في المتصفح لا بمكتبة PDF على الخادم: تشكيل
 * الحروف العربية ووصلها واتجاه النص أمور يتقنها المتصفح ولا تتقنها مكتبات
 * PDF إلا بتضمين خط ومحرّك تشكيل — ثمن كبير لنتيجة أسوأ.
 */
export function printCv(text: string): boolean {
  const blocks = parseCv(text);
  const rtl = isRtlText(text);
  const name = blocks.find((block) => block.type === 'name')?.text ?? 'السيرة الذاتية';

  const win = window.open('', '_blank', 'width=840,height=1000');
  if (!win) return false;

  win.document.write(`<!doctype html>
<html lang="${rtl ? 'ar' : 'en'}" dir="${rtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(name)}</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: ${rtl ? '"Tajawal", "Noto Sans Arabic", sans-serif' : 'Calibri, Arial, sans-serif'};
    color: #1a1a1a; line-height: 1.7; font-size: 11.5pt; margin: 0; padding: 24px;
  }
  h1 { font-size: 20pt; margin: 0 0 2px; }
  h2 {
    font-size: 11pt; text-transform: uppercase; letter-spacing: .04em;
    border-bottom: 1px solid #d4d4d4; padding-bottom: 3px; margin: 18px 0 8px; color: #444;
  }
  h3 { font-size: 12pt; margin: 12px 0 4px; }
  p { margin: 6px 0; }
  p.contact { color: #666; font-size: 10pt; margin-bottom: 14px; }
  ul { margin: 6px 0; padding-${rtl ? 'right' : 'left'}: 20px; }
  li { margin-bottom: 4px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
${blocksToHtml(blocks)}
<script>
  // انتظار تحميل الخط قبل الطباعة: الطباعة الفورية تُخرج صفحة بخط بديل
  window.addEventListener('load', function () {
    var go = function () { window.focus(); window.print(); };
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(go); } else { go(); }
  });
<\/script>
</body>
</html>`);
  win.document.close();
  return true;
}
