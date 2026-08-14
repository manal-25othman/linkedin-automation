import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Building2,
  FileStack,
  FolderTree,
  LayoutDashboard,
  LifeBuoy,
  MessagesSquare,
  Settings,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import type { Permission } from '@/lib/auth/rbac';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** الصلاحية المطلوبة لعرض العنصر — التحقق الفعلي يتم على الخادم أيضًا */
  permission: Permission;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

export const DASHBOARD_NAV: NavGroup[] = [
  {
    label: null,
    items: [
      {
        href: '/dashboard',
        label: 'الرئيسية',
        icon: LayoutDashboard,
        permission: 'assistant.use',
      },
      {
        href: '/assistant',
        label: 'المساعد الذكي',
        icon: Sparkles,
        permission: 'assistant.use',
      },
    ],
  },
  {
    label: 'المعرفة',
    items: [
      {
        href: '/knowledge-base',
        label: 'قاعدة المعرفة',
        icon: FolderTree,
        permission: 'categories.view',
      },
      {
        href: '/documents',
        label: 'المستندات',
        icon: FileStack,
        permission: 'documents.view',
      },
      {
        href: '/conversations',
        label: 'المحادثات',
        icon: MessagesSquare,
        permission: 'conversations.view_own',
      },
    ],
  },
  {
    label: 'الرؤى',
    items: [
      {
        href: '/knowledge-gaps',
        label: 'فجوات المعرفة',
        icon: Target,
        permission: 'knowledge_gaps.view',
      },
      {
        href: '/analytics',
        label: 'التحليلات',
        icon: BarChart3,
        permission: 'analytics.view_department',
      },
    ],
  },
  {
    label: 'الإدارة',
    items: [
      {
        href: '/users',
        label: 'المستخدمون',
        icon: Users,
        permission: 'users.view',
      },
      {
        href: '/departments',
        label: 'الأقسام',
        icon: Building2,
        permission: 'departments.view',
      },
      {
        href: '/support',
        label: 'الدعم الفني',
        icon: LifeBuoy,
        // متاح لكل مستخدم نشط: العطل قد يصيب موظفًا لا مديرًا، ومن
        // يواجه المشكلة أقدر على وصفها ممن يسمع عنها.
        permission: 'assistant.use',
      },
      {
        href: '/settings',
        label: 'الإعدادات',
        icon: Settings,
        permission: 'company.view_settings',
      },
    ],
  },
];
