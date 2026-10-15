/**
 * Shared type-safe interfaces to replace `any` across the codebase.
 */

// ─── Google Calendar Types ────────────────────────────────────────────────────

export interface CalendarEventAttendee {
  email: string;
  displayName?: string;
  responseStatus?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  self?: boolean;
}

export interface CalendarEventTime {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

export interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: CalendarEventTime;
  end?: CalendarEventTime;
  attendees?: CalendarEventAttendee[];
  location?: string;
  htmlLink?: string;
  status?: string;
}

// ─── Sentiment Analysis Types ─────────────────────────────────────────────────

export interface SentimentMetrics {
  avgReplyLatencyHours: number | null;
  avgReplyLengthWords: number | null;
  forwardLookingScore: number | null;
  questionSpecificityScore: number | null;
  proactiveReachOutCount: number;
}

export interface SentimentContact {
  id: string;
  name: string | null;
  email: string;
  company: string | null;
  pipelineStage: string;
  threads: Array<{ gmailThreadId: string }>;
}

export interface EmailMessageRecord {
  id: string;
  direction: string;
  sentAt: Date | null;
  bodyText: string | null;
  snippet: string | null;
}

// ─── Diagnostics Types ────────────────────────────────────────────────────────

export interface StageDropoutRate {
  entered: number;
  droppedOut: number;
  rate: number;
}

export interface DropoutTopic {
  topic: string;
  dropoutRate: number;
  note?: string;
}

export interface DiagnosticsNarrativeInput {
  dropoutByStage: Record<string, StageDropoutRate>;
  topDropoutTopics: DropoutTopic[];
  highPerformingPhrases: string[];
  lowPerformingPhrases: string[];
  velocityTrend: string;
}

// ─── Investor Seed Types ──────────────────────────────────────────────────────

export interface InvestorSeedRecord {
  name: string;
  email?: string;
  fundName?: string;
  fund_name?: string;
  fundSizeUsd?: number;
  fund_size_usd?: number;
  fundVintageYear?: number;
  fund_vintage_year?: number;
  investorType?: string;
  investor_type?: string;
  stageFocus?: string[];
  stage_focus?: string[];
  sectorFocus?: string[];
  sector_focus?: string[];
  geography?: string[];
  typicalCheckMinUsd?: number;
  typical_check_min_usd?: number;
  typicalCheckMaxUsd?: number;
  typical_check_max_usd?: number;
  linkedinUrl?: string;
  linkedin_url?: string;
  twitterHandle?: string;
  twitter_handle?: string;
  website?: string;
  photoUrl?: string;
  photo_url?: string;
  thesisRaw?: string;
  thesis_raw?: string;
  thesisSummary?: string;
  thesis_summary?: string;
  recentInvestments?: unknown;
  recent_investments?: unknown;
  investmentCount18mo?: number;
  investment_count_18mo?: number;
  lastKnownInvestmentDate?: string;
  last_known_investment_date?: string;
  isActivelyDeploying?: boolean;
  is_actively_deploying?: boolean;
  crunchbaseId?: string;
  crunchbase_id?: string;
}

// ─── Sequence Step Config (stored as JSON in Prisma) ──────────────────────────

export interface SequenceStepConfig {
  step: number;
  dayOffset: number;
  emailType: 'opening' | 'followup' | 'breakup';
  subjectHint?: string;
}

// ─── Pipeline Stuck Contact ──────────────────────────────────────────────────

export interface StuckContact {
  id: string;
  name: string;
  company: string;
  stage: string;
  daysInStage: number;
  avgForStage: number;
}

// ─── Investor Record (serialized with BigInt → string) ───────────────────────

export interface SerializedInvestorRecord {
  id: string;
  name: string;
  email: string | null;
  fundName: string | null;
  fundSizeUsd: string | null;
  investorType: string;
  stageFocus: string[];
  sectorFocus: string[];
  geography: string[];
  [key: string]: unknown;
}

// ─── Meeting Brief Contact ───────────────────────────────────────────────────

export interface MeetingBriefContact {
  id: string;
  name: string | null;
  email: string;
  company: string | null;
  pipelineStage: string;
}
