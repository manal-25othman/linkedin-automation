import { Fragment } from 'react';
import Link from 'next/link';
import { parseRichText, type InlineSpan } from '@/lib/content/rich-text';

/**
 * عرض نصّ صفحة صنعها مالك المنصة.
 *
 * لا `dangerouslySetInnerHTML` هنا ولا في أي مسار يؤدي إليه: كل ما يظهر
 * يمرّ بالمحلِّل ثم يُبنى عناصر React، فالنصّ المكتوب في اللوحة يبقى
 * نصًّا مهما احتوى. وهذه هي النقطة كلها.
 */

function renderSpans(spans: InlineSpan[]) {
  return spans.map((span, index) => {
    if (span.kind === 'bold') {
      return (
        <strong key={index} className="font-bold text-foreground">
          {span.text}
        </strong>
      );
    }
    if (span.kind === 'link') {
      const isExternal = /^(https:|mailto:)/i.test(span.href);
      return isExternal ? (
        <a
          key={index}
          href={span.href}
          target="_blank"
          rel="noreferrer nofollow"
          className="text-primary underline underline-offset-4"
        >
          {span.text}
        </a>
      ) : (
        <Link
          key={index}
          href={span.href}
          className="text-primary underline underline-offset-4"
        >
          {span.text}
        </Link>
      );
    }
    return <Fragment key={index}>{span.text}</Fragment>;
  });
}

export function PageBody({ body }: { body: string }) {
  const blocks = parseRichText(body);

  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        if (block.kind === 'heading') {
          return block.level === 2 ? (
            <h2 key={index} className="pt-4 text-xl font-bold sm:text-2xl">
              {renderSpans(block.spans)}
            </h2>
          ) : (
            <h3 key={index} className="pt-2 text-lg font-semibold">
              {renderSpans(block.spans)}
            </h3>
          );
        }

        if (block.kind === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul';
          return (
            <ListTag
              key={index}
              className={
                block.ordered
                  ? 'list-decimal space-y-2 ps-6 text-base leading-loose text-muted-foreground'
                  : 'list-disc space-y-2 ps-6 text-base leading-loose text-muted-foreground'
              }
            >
              {block.items.map((item, position) => (
                <li key={position}>{renderSpans(item)}</li>
              ))}
            </ListTag>
          );
        }

        return (
          <p key={index} className="text-base leading-loose text-muted-foreground">
            {renderSpans(block.spans)}
          </p>
        );
      })}
    </div>
  );
}
