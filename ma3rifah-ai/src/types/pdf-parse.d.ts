/**
 * تعريفات نوعية لـ pdf-parse (لا تُوفّرها المكتبة).
 * تغطي فقط ما نستخدمه فعليًا في src/lib/rag/extract.ts.
 */
declare module 'pdf-parse' {
  interface PdfPageData {
    getTextContent(options: {
      normalizeWhitespace?: boolean;
      disableCombineTextItems?: boolean;
    }): Promise<{ items: Array<{ str: string }> }>;
  }

  interface PdfParseOptions {
    /** يُستدعى لكل صفحة — نستخدمه لاستخراج نص كل صفحة على حدة */
    pagerender?: (pageData: PdfPageData) => Promise<string> | string;
    max?: number;
    version?: string;
  }

  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: unknown;
    version: string;
    text: string;
  }

  function pdfParse(
    dataBuffer: Buffer | Uint8Array,
    options?: PdfParseOptions,
  ): Promise<PdfParseResult>;

  export default pdfParse;
}
