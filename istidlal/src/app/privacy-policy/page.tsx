import type { Metadata } from "next";

import { MarkdownPage, buildPageMetadata } from "@/components/markdown-page";

export function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("privacy-policy");
}

export default function Page() {
  return <MarkdownPage slug="privacy-policy" />;
}
