import Image from "next/image";

import { COVER_SIZE } from "@/lib/og";

/**
 * غلاف المقال. الصورة مولَّدة وقت البناء من عنوان المقال وتصنيفه،
 * فلا نحتاج بنكًا للصور ولا نُحمّل أي أصل خارجي.
 */
export function ArticleCover({
  slug,
  title,
  priority = false,
  sizes = "(max-width: 768px) 100vw, 33vw",
  className = "",
}: {
  slug: string;
  title: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  return (
    <div className={`relative aspect-[16/9] overflow-hidden bg-surface-soft ${className}`}>
      <Image
        src={`/articles/${slug}/cover`}
        alt={`غلاف مقال: ${title}`}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover transition duration-300 group-hover:scale-[1.03]"
      />
    </div>
  );
}

export { COVER_SIZE };
