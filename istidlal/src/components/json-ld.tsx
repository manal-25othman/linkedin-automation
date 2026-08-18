/**
 * حقن البيانات المهيكلة. المحتوى مبنيّ في الخادم من ملفات المستودع،
 * ومع ذلك نهرّب `<` منعًا لكسر وسم السكربت.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
