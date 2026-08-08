import type { Metadata } from 'next';
import { AssistantShell } from './assistant-shell';

export const metadata: Metadata = { title: 'المساعد الذكي' };
export const dynamic = 'force-dynamic';

export default async function AssistantPage() {
  return <AssistantShell conversationId={null} />;
}
