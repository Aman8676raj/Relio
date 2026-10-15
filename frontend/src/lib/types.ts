export interface User {
  id: string;
  email: string;
  name: string | null;
  timezone: string;
  lastSyncAt: string | null;
  createdAt: string;
}

export type WarmthTier = 'hot' | 'warm' | 'cold' | 'frozen';
export type PipelineStage = 'none' | 'intro' | 'meeting' | 'dd' | 'term_sheet';
export type DraftFeedback = 'positive' | 'negative';

export interface Contact {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  company: string | null;
  firstContactedAt: string | null;
  lastContactedAt: string | null;
  totalEmails: number;
  replyRate: number;
  avgThreadDepth: number;
  warmthScore: number | null;
  warmthTier: WarmthTier;
  warmthScorePrevious: number | null;
  warmthTierOverride: WarmthTier | null;
  warmthUpdatedAt: string | null;
  pipelineStage: PipelineStage;
  pipelineUpdatedAt: string | null;
  notes: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContactWithThreads extends Contact {
  threads: ThreadSummary[];
}

export interface ThreadSummary {
  id: string;
  subject: string | null;
  snippet: string | null;
  messageCount: number;
  lastMessageAt: string | null;
}

export interface Draft {
  id: string;
  userId: string;
  contactId: string;
  generatedText: string | null;
  editedText: string | null;
  finalSentText: string | null;
  feedback: DraftFeedback | null;
  wasSent: boolean;
  gmailMessageId: string | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PipelineData {
  intro: Contact[];
  meeting: Contact[];
  dd: Contact[];
  term_sheet: Contact[];
}

export interface DigestPreview {
  contacts: Contact[];
}

export interface SyncStatus {
  taskId: string;
  status: string;
  progress: number | null;
  stats: { contactsFound: number; threadsStored: number } | null;
  error: string | null;
}
