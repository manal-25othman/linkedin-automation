import type { Metadata } from "next";

import { MarkdownPage, buildPageMetadata } from "@/components/markdown-page";

export function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("disclaimer");
}

export default function Page() {
  return <MarkdownPage slug="disclaimer" />;
}
