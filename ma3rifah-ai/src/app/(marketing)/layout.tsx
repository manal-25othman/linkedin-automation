import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';
import { FloatingDock } from '@/components/shared/floating-dock';
import { SiteChatWidget } from '@/components/marketing/site-chat-widget';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <FloatingDock>
        <SiteChatWidget />
      </FloatingDock>
    </div>
  );
}
