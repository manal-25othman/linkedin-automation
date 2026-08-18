/**
 * أنواع قاعدة البيانات.
 *
 * تُحافظ يدويًا لتبقى مطابقة لملفات supabase/migrations.
 * لتوليدها آليًا بدلًا من ذلك:
 *   supabase gen types typescript --project-id <ref> > src/types/database.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'MANAGER' | 'EMPLOYEE';
export type CompanyStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING';
export type ProfileStatus = 'ACTIVE' | 'INVITED' | 'DISABLED';
export type DocumentStatus = 'PROCESSING' | 'READY' | 'FAILED' | 'ARCHIVED';
export type DocumentSource = 'UPLOAD' | 'CURATED_ANSWER';
export type DocumentVisibility = 'COMPANY' | 'DEPARTMENT' | 'ROLE';
export type MessageRole = 'USER' | 'ASSISTANT';
export type AnswerStatus = 'ANSWERED' | 'UNANSWERED' | 'ERROR';
export type FeedbackValue = 'UP' | 'DOWN';
export type GapStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED';
type SiteContentRow = {
  key: string;
  value: string;
  updated_by: string | null;
  updated_at: string;
};

export type SitePageStatus = 'DRAFT' | 'PUBLISHED';

type SitePageRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  body: string;
  status: SitePageStatus;
  show_in_nav: boolean;
  sort_order: number;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentStatus = 'INITIATED' | 'PAID' | 'FAILED' | 'REFUNDED';

type PaymentRow = {
  id: string;
  company_id: string;
  plan_id: string;
  initiated_by: string | null;
  provider: string;
  provider_payment_id: string | null;
  /** بالهللة — عدد صحيح، لا عشري */
  amount_halalas: number;
  currency: string;
  status: PaymentStatus;
  failure_reason: string | null;
  provider_payload: Json | null;
  paid_at: string | null;
  /** لحظة تحويلها إلى اشتراك — تمنع تطبيقها مرتين */
  applied_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';
export type BillingInterval = 'MONTHLY' | 'YEARLY';

export interface CompanyAiSettings {
  tone: 'professional' | 'friendly' | 'concise';
  retrieval_top_k: number;
  min_similarity: number;
  max_context_chunks: number;
  history_window: number;
  allow_general_knowledge: boolean;
}

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  industry: string | null;
  country: string | null;
  timezone: string;
  locale: string;
  status: CompanyStatus;
  ai_settings: CompanyAiSettings;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};

type DepartmentRow = {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  company_id: string | null;
  department_id: string | null;
  full_name: string;
  email: string;
  job_title: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: ProfileStatus;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

type KnowledgeCategoryRow = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type DocumentRow = {
  id: string;
  company_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  /** UPLOAD = ملف مرفوع، CURATED_ANSWER = إجابة معتمدة لسدّ فجوة */
  source_kind: DocumentSource;
  storage_path: string | null;
  file_url: string | null;
  file_type: string;
  file_size_bytes: number;
  checksum: string | null;
  status: DocumentStatus;
  error_message: string | null;
  version: number;
  visibility: DocumentVisibility;
  allowed_department_ids: string[];
  allowed_roles: UserRole[];
  page_count: number | null;
  char_count: number;
  chunk_count: number;
  processed_at: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

type DocumentChunkRow = {
  id: string;
  company_id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  page_number: number | null;
  section_title: string | null;
  embedding: string | null;
  created_at: string;
};

type ConversationRow = {
  id: string;
  company_id: string;
  user_id: string;
  title: string;
  message_count: number;
  last_message_at: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  company_id: string;
  conversation_id: string;
  user_id: string | null;
  role: MessageRole;
  content: string;
  answer_status: AnswerStatus | null;
  feedback: FeedbackValue | null;
  feedback_note: string | null;
  latency_ms: number | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  /** درجة ثقة مركّبة ∈ [0,1] — تُحسب بعد التوليد بالتحقق من المصادر */
  confidence: number | null;
  /** نسبة رموز الإجابة الموجودة في المصادر ∈ [0,1] */
  groundedness: number | null;
  /** عدد الأرقام في الإجابة بلا أصل في المصادر */
  unverified_numbers: number;
  /** استُنتجت المصادر معجميًا لغياب استشهاد صريح من النموذج */
  citations_inferred: boolean;
  created_at: string;
};

type MessageSourceRow = {
  id: string;
  company_id: string;
  message_id: string;
  document_id: string | null;
  chunk_id: string | null;
  document_name: string;
  page_number: number | null;
  section_title: string | null;
  similarity: number | null;
  excerpt: string | null;
  created_at: string;
};

type KnowledgeGapRow = {
  id: string;
  company_id: string;
  question: string;
  normalized_question: string;
  times_asked: number;
  department_id: string | null;
  status: GapStatus;
  resolution_note: string | null;
  linked_document_id: string | null;
  /** الإجابة المعتمدة كما كتبها المدير */
  answer_text: string | null;
  /** المستند المشتقّ من الإجابة — هو ما يجده البحث الدلالي */
  answer_document_id: string | null;
  first_asked_at: string;
  last_asked_at: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type KnowledgeGapAskerRow = {
  gap_id: string;
  user_id: string;
  company_id: string;
  asked_at: string;
  notified_at: string | null;
};

export type NotificationType =
  | 'GAP_ANSWERED'
  | 'GAP_OPENED'
  | 'DOCUMENT_FAILED'
  | 'DOCUMENT_READY'
  | 'QUOTA_WARNING'
  | 'LOW_CONFIDENCE';

type NotificationRow = {
  id: string;
  company_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  /** مسار داخلي فقط — تفرض قاعدة البيانات ذلك */
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

type WhatsAppLinkRow = {
  id: string;
  company_id: string;
  user_id: string;
  /** E.164 بلا رموز */
  phone: string | null;
  link_code: string | null;
  code_expires_at: string | null;
  verified_at: string | null;
  last_used_at: string | null;
  messages_today: number;
  messages_day: string | null;
  created_at: string;
};

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

type SupportTicketRow = {
  id: string;
  company_id: string;
  created_by: string | null;
  subject: string;
  category: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  last_reply_at: string;
  /** آخر رسالة من العميل ⇒ التذكرة تنتظر ردّ المنصة */
  awaiting_platform: boolean;
  resolved_at: string | null;
  created_at: string;
};

type SupportMessageRow = {
  id: string;
  ticket_id: string;
  company_id: string;
  author_id: string | null;
  from_platform: boolean;
  body: string;
  created_at: string;
};

type AnalyticsEventRow = {
  id: string;
  company_id: string;
  user_id: string | null;
  department_id: string | null;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Json;
  created_at: string;
};

type PlanRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_amount: number | null;
  currency: string;
  billing_interval: BillingInterval;
  max_users: number | null;
  max_documents: number | null;
  max_questions_monthly: number | null;
  max_storage_mb: number | null;
  features: string[];
  is_public: boolean;
  is_custom_priced: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type SubscriptionRow = {
  id: string;
  company_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  trial_ends_at: string | null;
  canceled_at: string | null;
  limit_overrides: Json;
  external_customer_id: string | null;
  external_subscription_id: string | null;
  created_at: string;
  updated_at: string;
};

type UsageRecordRow = {
  id: string;
  company_id: string;
  period_month: string;
  questions_count: number;
  documents_count: number;
  storage_mb: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  created_at: string;
  updated_at: string;
};

type AiUsageLogRow = {
  id: string;
  company_id: string;
  user_id: string | null;
  operation: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  latency_ms: number | null;
  created_at: string;
};

type AuditLogRow = {
  id: string;
  company_id: string | null;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Json;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

/**
 * محادثة زوّار الموقع — على مستوى المنصة لا الشركة.
 * لاحظ غياب company_id: لا سبيل بنيويًا لربطها ببيانات أي شركة.
 */
export type SiteChatStatus = 'ANSWERED' | 'UNANSWERED' | 'REFUSED' | 'ERROR';

type SiteVisitorRow = {
  id: string;
  visitor_key: string;
  message_count: number;
  first_seen_at: string;
  last_seen_at: string;
  entry_path: string | null;
  converted: boolean;
};

type SiteChatMessageRow = {
  id: string;
  visitor_id: string;
  role: MessageRole;
  content: string;
  status: SiteChatStatus | null;
  latency_ms: number | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
};

export type ContactRequestStatus = 'NEW' | 'CONTACTED' | 'CLOSED';

type ContactRequestRow = {
  id: string;
  full_name: string;
  email: string;
  company_name: string;
  phone: string | null;
  company_size: string | null;
  message: string;
  source: string;
  status: ContactRequestStatus;
  created_at: string;
};

/**
 * جدول قابل للقراءة والكتابة والتحديث.
 *
 * القيد `extends Record<string, unknown>` مقصود: عميل Supabase يشترط
 * أن يحقق كل جدول واجهة GenericTable، ولو سقط القيد لصار نوع العميل
 * `never` بصمت وضاعت كل أنواع الاستعلامات.
 */
type Table<Row extends Record<string, unknown>> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      companies: Table<CompanyRow>;
      departments: Table<DepartmentRow>;
      profiles: Table<ProfileRow>;
      knowledge_categories: Table<KnowledgeCategoryRow>;
      documents: Table<DocumentRow>;
      document_chunks: Table<DocumentChunkRow>;
      conversations: Table<ConversationRow>;
      messages: Table<MessageRow>;
      message_sources: Table<MessageSourceRow>;
      knowledge_gaps: Table<KnowledgeGapRow>;
      knowledge_gap_askers: Table<KnowledgeGapAskerRow>;
      notifications: Table<NotificationRow>;
      whatsapp_links: Table<WhatsAppLinkRow>;
      support_tickets: Table<SupportTicketRow>;
      support_messages: Table<SupportMessageRow>;
      analytics_events: Table<AnalyticsEventRow>;
      plans: Table<PlanRow>;
      site_content: Table<SiteContentRow>;
      site_pages: Table<SitePageRow>;
      payments: Table<PaymentRow>;
      subscriptions: Table<SubscriptionRow>;
      usage_records: Table<UsageRecordRow>;
      ai_usage_logs: Table<AiUsageLogRow>;
      audit_logs: Table<AuditLogRow>;
      contact_requests: Table<ContactRequestRow>;
      site_visitors: Table<SiteVisitorRow>;
      site_chat_messages: Table<SiteChatMessageRow>;
    };
    Views: Record<string, never>;
    Functions: {
      match_document_chunks: {
        Args: {
          p_query_embedding: string;
          p_match_count?: number;
          p_min_similarity?: number;
          p_category_ids?: string[] | null;
        };
        Returns: {
          chunk_id: string;
          document_id: string;
          document_name: string;
          category_id: string | null;
          content: string;
          page_number: number | null;
          section_title: string | null;
          similarity: number;
        }[];
      };
      record_knowledge_gap: {
        Args: { p_question: string };
        Returns: string | null;
      };
      check_question_quota: {
        Args: Record<string, never>;
        Returns: { allowed: boolean; used: number; quota: number }[];
      };
      activate_subscription_for_payment: {
        Args: { p_payment_id: string };
        Returns: boolean;
      };
      check_user_quota: {
        Args: Record<string, never>;
        Returns: { allowed: boolean; used: number; quota: number }[];
      };
      check_document_quota: {
        Args: Record<string, never>;
        Returns: { allowed: boolean; used: number; quota: number }[];
      };
      check_storage_quota: {
        Args: { p_incoming_bytes?: number };
        Returns: { allowed: boolean; used_mb: number; quota_mb: number }[];
      };
      record_usage: {
        Args: {
          p_company_id: string;
          p_questions?: number;
          p_input_tokens?: number;
          p_output_tokens?: number;
          p_cost_usd?: number;
        };
        Returns: void;
      };
      normalize_question: {
        Args: { p_text: string };
        Returns: string;
      };
      company_dashboard_stats: {
        Args: Record<string, never>;
        Returns: {
          users_count: number;
          documents_count: number;
          documents_ready: number;
          documents_processing: number;
          conversations_count: number;
          questions_count: number;
          answered_count: number;
          unanswered_count: number;
          open_gaps_count: number;
        }[];
      };
      company_top_questions: {
        Args: { p_limit?: number };
        Returns: {
          question: string;
          times_asked: number;
          answered: number;
          unanswered: number;
        }[];
      };
      company_questions_timeseries: {
        Args: { p_days?: number };
        Returns: {
          day: string;
          total: number;
          answered: number;
          unanswered: number;
        }[];
      };
      company_top_documents: {
        Args: { p_limit?: number };
        Returns: {
          document_id: string;
          document_name: string;
          citations: number;
        }[];
      };
      company_department_usage: {
        Args: Record<string, never>;
        Returns: {
          department_id: string;
          department_name: string;
          questions: number;
          active_users: number;
        }[];
      };
      company_recent_activity: {
        Args: { p_limit?: number };
        Returns: {
          id: string;
          action: string;
          entity_type: string | null;
          actor_name: string;
          metadata: Json;
          created_at: string;
        }[];
      };
      seed_match_chunks: {
        Args: {
          p_company_id: string;
          p_query_embedding: string;
          p_match_count?: number;
        };
        Returns: {
          chunk_id: string;
          document_id: string;
          document_name: string;
          content: string;
          page_number: number | null;
          section_title: string | null;
          similarity: number;
        }[];
      };
      company_usage_summary: {
        Args: Record<string, never>;
        Returns: {
          plan_name: string;
          plan_code: string;
          subscription_status: string;
          period_end: string;
          users_used: number;
          users_limit: number | null;
          documents_used: number;
          documents_limit: number | null;
          questions_used: number;
          questions_limit: number | null;
        }[];
      };
      company_cost_breakdown: {
        Args: { p_company_id: string; p_months?: number };
        Returns: {
          period_month: string;
          operation: string;
          calls: number;
          input_tokens: number;
          output_tokens: number;
          cost_usd: number;
        }[];
      };
      platform_margin_report: {
        Args: Record<string, never>;
        Returns: {
          company_id: string;
          company_name: string;
          plan_name: string | null;
          price_amount: number | null;
          currency: string | null;
          cost_usd_month: number;
          questions_month: number;
          questions_limit: number | null;
          cost_ratio: number | null;
        }[];
      };
      platform_companies_report: {
        Args: Record<string, never>;
        Returns: {
          company_id: string;
          company_name: string;
          status: CompanyStatus;
          is_demo: boolean;
          plan_name: string | null;
          subscription_status: SubscriptionStatus | null;
          users_count: number;
          documents_count: number;
          questions_count: number;
          unanswered_count: number;
          open_tickets: number;
          last_activity_at: string | null;
          created_at: string;
        }[];
      };
      request_whatsapp_link_code: {
        Args: Record<string, never>;
        Returns: { code: string; expires_at: string }[];
      };
      match_chunks_for_user: {
        Args: {
          p_user_id: string;
          p_query_embedding: string;
          p_match_count?: number;
          p_min_similarity?: number;
          p_category_ids?: string[] | null;
        };
        Returns: {
          chunk_id: string;
          document_id: string;
          document_name: string;
          category_id: string | null;
          content: string;
          page_number: number | null;
          section_title: string | null;
          similarity: number;
        }[];
      };
      unread_notification_count: {
        Args: Record<string, never>;
        Returns: number;
      };
      mark_notifications_read: {
        Args: { p_ids?: string[] };
        Returns: number;
      };
      company_answer_quality: {
        Args: { p_days?: number };
        Returns: {
          answers_total: number;
          answers_with_source: number;
          avg_latency_ms: number;
          feedback_up: number;
          feedback_down: number;
          feedback_total: number;
          avg_confidence: number;
          avg_groundedness: number;
          low_confidence_count: number;
          unverified_number_answers: number;
        }[];
      };
      company_active_users: {
        Args: { p_days?: number };
        Returns: {
          active_users: number;
          total_users: number;
          new_users: number;
          top_user_name: string | null;
          top_user_questions: number | null;
        }[];
      };
      company_hourly_activity: {
        Args: { p_days?: number };
        Returns: { hour_of_day: number; questions: number }[];
      };
      company_cost_summary: {
        Args: { p_months?: number };
        Returns: {
          period_month: string;
          questions_count: number;
          input_tokens: number;
          output_tokens: number;
          estimated_cost_usd: number;
        }[];
      };
      platform_visitor_stats: {
        Args: { p_days?: number };
        Returns: {
          visitors_total: number;
          visitors_in_period: number;
          questions_total: number;
          answered_count: number;
          unanswered_count: number;
          converted_count: number;
        }[];
      };
      platform_visitor_unanswered: {
        Args: { p_limit?: number };
        Returns: { question: string; asked_at: string }[];
      };
    };
    Enums: {
      user_role: UserRole;
      company_status: CompanyStatus;
      profile_status: ProfileStatus;
      document_status: DocumentStatus;
      document_visibility: DocumentVisibility;
      message_role: MessageRole;
      answer_status: AnswerStatus;
      feedback_value: FeedbackValue;
      gap_status: GapStatus;
      subscription_status: SubscriptionStatus;
      billing_interval: BillingInterval;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type Company = Tables<'companies'>;
export type Department = Tables<'departments'>;
export type Profile = Tables<'profiles'>;
export type KnowledgeCategory = Tables<'knowledge_categories'>;
export type DocumentRecord = Tables<'documents'>;
export type DocumentChunk = Tables<'document_chunks'>;
export type Conversation = Tables<'conversations'>;
export type Message = Tables<'messages'>;
export type MessageSource = Tables<'message_sources'>;
export type KnowledgeGap = Tables<'knowledge_gaps'>;
export type Plan = Tables<'plans'>;
export type Subscription = Tables<'subscriptions'>;
export type UsageRecord = Tables<'usage_records'>;
export type AuditLog = Tables<'audit_logs'>;
