import fs from "node:fs";
import path from "node:path";

import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

/** الخط مرفق في المستودع؛ محرّك التوليد يحتاج ملف الخط نفسه لا اسمه. */
function loadFont(): Buffer {
  return fs.readFileSync(path.join(process.cwd(), "src/assets/tajawal-bold.ttf"));
}

/**
 * محرّك صور المشاركة يرصف الكلمات من اليسار لليمين ولا يعيد ترتيب النص العربي.
 * لذلك نقسّم العنوان إلى أسطر بأنفسنا ونعكس كلمات كل سطر، فيظهر بترتيب
 * القراءة الصحيح. كل سطر يُرسم منفردًا حتى لا يلتفّ تلقائيًّا فيختلّ الترتيب.
 */
function toRtlLines(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let current: string[] = [];
  let length = 0;

  for (const word of text.split(/\s+/)) {
    if (length + word.length + (current.length ? 1 : 0) > maxChars && current.length) {
      lines.push(current.reverse().join(" "));
      current = [];
      length = 0;
    }
    current.push(word);
    length += word.length + (current.length > 1 ? 1 : 0);
  }
  if (current.length) lines.push(current.reverse().join(" "));

  return lines;
}

/** شعار الاستلزام المنطقي مرسومًا بالعناصر — الرمز نفسه غير موجود في الخط. */
function Mark() {
  return (
    <div
      style={{
        width: 74,
        height: 74,
        borderRadius: 21,
        background: "#0E7C86",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", right: 24, top: 19, width: 6, height: 36, borderRadius: 3, background: "#fff" }} />
      <div style={{ position: "absolute", right: 24, top: 34, width: 24, height: 6, borderRadius: 3, background: "#fff" }} />
      <div style={{ position: "absolute", right: 44, top: 29, width: 16, height: 16, borderRadius: 8, background: "#fff" }} />
    </div>
  );
}

export function renderOgImage({ title, eyebrow }: { title: string; eyebrow: string }) {
  const font = loadFont();
  const fontSize = title.length > 60 ? 52 : 60;
  const lines = toRtlLines(title, fontSize > 55 ? 30 : 34);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0b1220",
          padding: "64px 76px",
          fontFamily: "Tajawal",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, alignSelf: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ color: "#E8EDF5", fontSize: 36 }}>استدلال</span>
            <span style={{ color: "#6b7c93", fontSize: 17, letterSpacing: 4 }}>ISTIDLAL.AI</span>
          </div>
          <Mark />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "flex-end" }}>
          <span style={{ color: "#2AB7C4", fontSize: 27 }}>
            {toRtlLines(eyebrow, 60).join(" ")}
          </span>
          {lines.map((line) => (
            <span key={line} style={{ color: "#E8EDF5", fontSize, lineHeight: 1.35 }}>
              {line}
            </span>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, alignSelf: "flex-end" }}>
          <span style={{ color: "#94a3b8", fontSize: 22 }}>
            {toRtlLines("بالقياس لا بالانطباع", 60).join(" ")}
          </span>
          <div style={{ width: 88, height: 6, background: "#0E7C86", borderRadius: 999 }} />
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [{ name: "Tajawal", data: font, style: "normal", weight: 700 }],
    },
  );
}
