import { OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "استدلال — هندسة أنظمة الذكاء الاصطناعي التطبيقية";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return renderOgImage({
    eyebrow: "مدونة تقنية متخصصة",
    title: "هندسة أنظمة الذكاء الاصطناعي التطبيقية",
  });
}
