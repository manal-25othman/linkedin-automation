/**
 * لا تشحن pdfjs-dist تعريفات لوحدة العامل، فهي في الاستعمال المعتاد
 * تُحمَّل بمسار نصّي لا باستيراد. نستوردها هنا صراحةً كي يتتبّعها
 * المُجمِّع فتُنسخ إلى حزمة النشر، ولا نستعمل منها سوى تسجيلها.
 */
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs' {
  export const WorkerMessageHandler: unknown;
}
