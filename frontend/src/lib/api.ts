// ─── API Layer ──────────────────────────────────────────────────────────

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Important for sending/receiving cookies!
  });

  if (!response.ok) {
    let errorMessage = 'An error occurred';
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch {
      errorMessage = response.statusText;
    }
    throw new Error(errorMessage);
  }

  // Handle empty responses (like 204 No Content or empty 200 OK from logout)
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  
  return null as any;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ContactResponse {
  id: string; email: string; name: string | null; company: string | null;
  firstContactedAt: string | null; lastContactedAt: string | null;
  totalEmails: number; replyRate: number; avgThreadDepth: number;
  warmthScore: number | null; warmthTier: 'hot' | 'warm' | 'cold' | 'frozen';
  warmthTierOverride: string | null; pipelineStage: string;
  pipelineUpdatedAt: string | null; notes: string | null;
  isArchived: boolean; createdAt: string; updatedAt: string;
}

export interface ContactDetailResponse extends ContactResponse {
  threads: { id: string; subject: string | null; snippet: string | null; messageCount: number; lastMessageAt: string | null; }[];
}

export interface ContactsListResponse {
  data: ContactResponse[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CommitmentItem { text: string; direction: 'inbound' | 'outbound'; extractedFrom: string; status: 'open' | 'dismissed' | 'completed'; }

export interface BriefingResponse {
  id: string; summary: string; keyFacts: string[]; openQuestions: string[];
  commitments: CommitmentItem[]; sentiment: 'positive' | 'neutral' | 'cautious' | 'cold';
  lastMeetingMentioned: string | null; generatedAt: string; cached: boolean;
}

export interface PipelineResponse {
  intro: ContactResponse[]; meeting: ContactResponse[]; dd: ContactResponse[];
  term_sheet: ContactResponse[]; closed_won: ContactResponse[];
  closed_lost: ContactResponse[]; paused: ContactResponse[];
}

export interface PipelineEvent {
  id: string; contactId: string; fromStage: string; toStage: string;
  trigger: 'manual' | 'auto' | 'signal'; reason: string | null; createdAt: string;
}

export interface IntroPathResult {
  sourceContact: { id: string; name: string | null; email: string; warmthTier: string; };
  targetContact: { id: string; name: string | null; email: string; company: string | null; };
  strengthScore: number; sharedThreadCount: number; reasoning: string;
}

export interface DraftResponse {
  id: string; contactId: string; generatedText: string | null;
  editedText: string | null; finalSentText: string | null;
  wasSent: boolean; feedback: 'positive' | 'negative' | null;
  createdAt: string; contact?: ContactResponse;
}

export interface DraftsListResponse { data: DraftResponse[]; meta: { total: number }; }

export interface ContactSummary {
  id: string; name: string | null; email: string; company: string | null;
  warmthTier: string; warmthScore: number | null; lastContactedAt: string | null;
  pipelineStage: string; lastInboundAt: string | null; lastOutboundAt: string | null;
}

export interface TierBucket { count: number; atRisk: number; overdueTouch: number; }

export interface PulseResponse {
  momentum: { score: number; delta: number; confidence: string; activeConversations: number; basedOn: string; };
  softGhosts: { count: number; contacts: ContactSummary[] };
  tierBreakdown: { hot: TierBucket; warm: TierBucket; cold: TierBucket; frozen: TierBucket };
  weeklyDelta: { newReplies: number; newGhosts: number; momentumChange: number };
}

export interface PriorityAction {
  type: 'follow_up' | 'at_risk' | 'stalled_pipeline';
  contact: ContactSummary; reason: string; ctaLabel: string;
  ctaType: 'draft' | 'view_thread'; priority: number;
}

export interface ReportMetric { name: string; grade: string; note: string; }

export interface DigestNurtureContact {
  id: string; name: string | null; email: string; company: string | null;
  warmthTier: string; lastContactedAt: string | null; reason: string;
}

export interface DashboardDigestResponse {
  newReplies: number; newSoftGhosts: number; momentumDelta: number;
  nurtureContacts: DigestNurtureContact[]; generatedAt: string;
}

export interface SettingsResponse {
  profile: { id: string; email: string; name: string | null; createdAt: string; };
  integrations: { gmail: { connected: boolean; email: string | null; lastSyncAt: string | null }; calendar: { connected: boolean }; linkedin: { connected: boolean }; };
  preferences: { notifications: { digestEnabled: boolean; digestTime: string; timezone: string; hotAlerts: boolean; weeklyReport: boolean; }; ai: { autoGenerate: boolean; tone: string; length: string; includeSignature: boolean; }; };
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  me: () => fetchClient<any>('/auth/me'),
  logout: () => fetchClient<any>('/auth/logout', { method: 'POST' }),
  login: (data: any) => fetchClient<any>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  signup: (data: any) => fetchClient<any>('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Contacts ────────────────────────────────────────────────────────────────

export const contactsApi = {
  list: (params?: Record<string, string>) => {
    const query = new URLSearchParams(params).toString();
    const qs = query ? `?${query}` : '';
    return fetchClient<ContactsListResponse>(`/api/contacts${qs}`);
  },
  get: (id: string) => fetchClient<ContactDetailResponse>(`/api/contacts/${id}`),
  create: (data: { email: string; name?: string; company?: string; notes?: string; pipelineStage?: string }) => 
    fetchClient<ContactResponse>('/api/contacts', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, any>) => 
    fetchClient<ContactResponse>(`/api/contacts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

// ─── Briefing ────────────────────────────────────────────────────────────────

export const briefingApi = {
  get: (contactId: string) => fetchClient<BriefingResponse>(`/api/contacts/${contactId}/briefing`),
  updateCommitment: (contactId: string, index: number, status: string) => 
    fetchClient<any>(`/api/contacts/${contactId}/briefing/commitments`, { 
      method: 'PATCH', 
      body: JSON.stringify({ index, status }) 
    }),
};

// ─── Pipeline ────────────────────────────────────────────────────────────────

export const pipelineApi = {
  get: () => fetchClient<PipelineResponse>('/api/pipeline'),
  updateStage: (contactId: string, stage: string) => contactsApi.update(contactId, { pipelineStage: stage }),
  getEvents: (contactId: string) => fetchClient<PipelineEvent[]>(`/api/pipeline/events/${contactId}`),
};

// ─── Intro Paths ─────────────────────────────────────────────────────────────

export const introPathApi = {
  getTop: () => fetchClient<IntroPathResult[]>('/api/contacts/intro-paths'),
  getForContact: (contactId: string) => fetchClient<IntroPathResult[]>(`/api/contacts/${contactId}/intro-paths`),
  compute: () => fetchClient<any>('/api/contacts/intro-paths/compute', { method: 'POST' }),
};

// ─── Drafts ──────────────────────────────────────────────────────────────────

export const draftsApi = {
  list: () => fetchClient<DraftsListResponse>('/api/drafts'),
  preview: (contactId: string) => fetchClient<any>(`/api/drafts/preview`, { method: 'POST', body: JSON.stringify({ contact_id: contactId }) }),
  send: (id: string, text: string, subject?: string) => 
    fetchClient<any>(`/api/drafts/${id}/send`, { method: 'POST', body: JSON.stringify({ text, subject }) }),
  feedback: (id: string, feedback: 'positive' | 'negative') => 
    fetchClient<any>(`/api/drafts/${id}/feedback`, { method: 'POST', body: JSON.stringify({ feedback }) }),
};

// ─── Sync ────────────────────────────────────────────────────────────────────

export interface SyncResult {
  status: 'completed' | 'failed' | 'queued';
  contactsFound?: number;
  threadsStored?: number;
  error?: string;
  taskId?: string;
}

export const syncApi = {
  /** Full Gmail sync — runs directly, waits and returns stats */
  triggerDirect: () => fetchClient<SyncResult>('/api/sync/direct', { method: 'POST' }),
  /** Queue-based sync */
  trigger: () => fetchClient<SyncResult>('/api/sync', { method: 'POST' }),
  /** Check queue job status */
  checkStatus: (taskId: string) => fetchClient<SyncResult>(`/api/sync/${taskId}`),
};

// ─── Dashboard ───────────────────────────────────────────────────────────────

export const dashboardApi = {
  pulse: () => fetchClient<PulseResponse>('/api/dashboard/pulse'),
  actions: () => fetchClient<PriorityAction[]>('/api/dashboard/actions'),
  reportCard: () => fetchClient<any>('/api/dashboard/report-card'),
};

// ─── Digest ──────────────────────────────────────────────────────────────────

export const digestApi = {
  dashboard: () => fetchClient<DashboardDigestResponse>('/api/digest/dashboard'),
};

// ─── Settings ────────────────────────────────────────────────────────────────

export const settingsApi = {
  get: () => fetchClient<SettingsResponse>('/api/settings'),
  update: (data: Record<string, any>) => fetchClient<any>('/api/settings', { method: 'PATCH', body: JSON.stringify(data) }),
  changePassword: (currentPassword: string, newPassword: string) => fetchClient<any>('/auth/password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) }),
};

// ─── Pipeline Velocity ───────────────────────────────────────────────────────
export const pipelineVelocityApi = {
  get: () => fetchClient<any>('/api/pipeline/velocity'),
};

// ─── Activity Heatmap ────────────────────────────────────────────────────────
export const heatmapApi = {
  get: () => fetchClient<any>('/api/dashboard/heatmap'),
};

// ─── Investor Database ───────────────────────────────────────────────────────

export interface InvestorRecord {
  id: string;
  name: string;
  email: string | null;
  fundName: string | null;
  fundSizeUsd: string | null;
  fundVintageYear: number | null;
  investorType: string | null;
  stageFocus: string[];
  sectorFocus: string[];
  geography: string[];
  typicalCheckMinUsd: number | null;
  typicalCheckMaxUsd: number | null;
  linkedinUrl: string | null;
  twitterHandle: string | null;
  website: string | null;
  photoUrl: string | null;
  thesisRaw: string | null;
  thesisSummary: string | null;
  recentInvestments: { company: string; amount?: number; date?: string; sector?: string; stage?: string }[] | null;
  investmentCount18mo: number;
  lastKnownInvestmentDate: string | null;
  isActivelyDeploying: boolean;
  crunchbaseId: string | null;
  dataQualityScore: number;
  lastEnrichedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvestorsListResponse {
  data: InvestorRecord[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface InvestorFilterOptions {
  investorTypes: string[];
  stages: string[];
  sectors: string[];
  geographies: string[];
}

export interface InvestorDbStats {
  total: number;
  activelyDeploying: number;
  avgDataQuality: number;
  byType: { type: string; count: number }[];
}

export const investorsApi = {
  list: (params?: Record<string, string>) => {
    const query = new URLSearchParams(params).toString();
    const qs = query ? `?${query}` : '';
    return fetchClient<InvestorsListResponse>(`/api/investors${qs}`);
  },
  get: (id: string) => fetchClient<InvestorRecord>(`/api/investors/${id}`),
  filters: () => fetchClient<InvestorFilterOptions>('/api/investors/filters'),
  stats: () => fetchClient<InvestorDbStats>('/api/investors/stats'),
  seed: (investors: any[]) =>
    fetchClient<{ created: number; updated: number }>('/api/investors/seed', {
      method: 'POST',
      body: JSON.stringify({ investors }),
    }),
};

// ─── Discovery Engine ────────────────────────────────────────────────────────

export interface StartupProfile {
  id: string;
  userId: string;
  name: string | null;
  stage: string | null;
  sector: string | null;
  subSector: string | null;
  arrUsd: number | null;
  geography: string | null;
  raiseTargetUsd: number | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiscoveryScoreBreakdown {
  composite: number;
  portfolioFit: number | null;
  thesisAlignment: number | null;
  thesisReason: string | null;
  fundDeployment: string | null;
  warmPath: number | null;
  warmPathSummary: string | null;
  lastScored: string;
}

export interface ScoredInvestor {
  investor: InvestorRecord;
  score: DiscoveryScoreBreakdown | null;
  needsScoring: boolean;
}

export interface DiscoverySearchResponse {
  data: ScoredInvestor[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  profileComplete: boolean;
}

export const discoveryApi = {
  getProfile: () => fetchClient<StartupProfile | { needsSetup: true }>('/api/discovery/profile'),
  updateProfile: (data: Partial<StartupProfile>) =>
    fetchClient<StartupProfile>('/api/discovery/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  search: (params?: Record<string, string>) => {
    const query = new URLSearchParams(params).toString();
    const qs = query ? `?${query}` : '';
    return fetchClient<DiscoverySearchResponse>(`/api/discovery/search${qs}`);
  },
  scoreInvestor: (investorId: string) =>
    fetchClient<any>(`/api/discovery/score/${investorId}`, { method: 'POST' }),
  batchScore: (limit?: number) =>
    fetchClient<{ scored: number; total: number }>('/api/discovery/score-batch', {
      method: 'POST',
      body: JSON.stringify({ limit: limit || 100 }),
    }),
};

// ─── Sequence Engine ─────────────────────────────────────────────────────────

export interface SequenceStep {
  step: number;
  dayOffset: number;
  emailType: 'opening' | 'followup' | 'breakup';
  subjectHint?: string;
}

export interface SequenceRecord {
  id: string;
  userId: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  steps: SequenceStep[];
  createdAt: string;
  updatedAt: string;
  stats?: {
    total: number;
    draft: number;
    approved: number;
    active: number;
    replied: number;
    completed: number;
    skipped: number;
  };
  _count?: { enrollments: number };
}

export interface SequenceEmail {
  id: string;
  enrollmentId: string;
  stepNumber: number;
  subject: string | null;
  body: string | null;
  status: 'draft' | 'approved' | 'sent' | 'opened' | 'replied';
  generatedAt: string;
  approvedAt: string | null;
  sentAt: string | null;
  openedAt: string | null;
  gmailMessageId: string | null;
}

export interface SequenceEnrollment {
  id: string;
  sequenceId: string;
  contactId: string;
  userId: string;
  status: 'draft' | 'approved' | 'active' | 'replied' | 'completed' | 'skipped';
  currentStep: number;
  enrolledAt: string;
  nextSendAt: string | null;
  repliedAt: string | null;
  contact?: {
    id: string;
    name: string | null;
    email: string;
    company: string | null;
    warmthTier: string;
  };
  emails?: SequenceEmail[];
}

export interface SequenceDetail extends SequenceRecord {
  enrollments: SequenceEnrollment[];
}

export interface SequenceListResponse {
  data: SequenceRecord[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface SequenceAnalytics {
  sequenceId: string;
  sequenceName: string;
  status: string;
  totalEnrolled: number;
  byStatus: {
    draft: number;
    approved: number;
    active: number;
    replied: number;
    completed: number;
    skipped: number;
  };
  emailStats: {
    total: number;
    draft: number;
    approved: number;
    sent: number;
    opened: number;
    replied: number;
  };
  replyRate: number;
}

export const sequencesApi = {
  list: (params?: Record<string, string>) => {
    const query = new URLSearchParams(params).toString();
    const qs = query ? `?${query}` : '';
    return fetchClient<SequenceListResponse>(`/api/sequences${qs}`);
  },
  get: (id: string) => fetchClient<SequenceDetail>(`/api/sequences/${id}`),
  create: (data: { name: string; steps?: SequenceStep[] }) =>
    fetchClient<SequenceRecord>('/api/sequences', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateStatus: (id: string, status: string) =>
    fetchClient<SequenceRecord>(`/api/sequences/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  enroll: (id: string, contactIds: string[]) =>
    fetchClient<{ enrolled: number; results: { contactId: string; enrollmentId: string; emailGenerated: boolean }[] }>(
      `/api/sequences/${id}/enroll`,
      { method: 'POST', body: JSON.stringify({ contactIds }) },
    ),
  approveEmail: (emailId: string, data?: { subject?: string; body?: string }) =>
    fetchClient<SequenceEmail>(`/api/sequences/emails/${emailId}/approve`, {
      method: 'PUT',
      body: JSON.stringify(data || {}),
    }),
  skipEnrollment: (enrollmentId: string) =>
    fetchClient<SequenceEnrollment>(`/api/sequences/enrollments/${enrollmentId}/skip`, {
      method: 'PATCH',
    }),
  batchApprove: (id: string) =>
    fetchClient<{ approved: number; enrollments: number }>(`/api/sequences/${id}/batch-approve`, {
      method: 'POST',
    }),
  analytics: (id: string) =>
    fetchClient<SequenceAnalytics>(`/api/sequences/${id}/analytics`),
};

// ─── Round Forecasting ───────────────────────────────────────────────────────

export interface ForecastSnapshot {
  id: string;
  targetRaiseUsd: number | null;
  committedUsd: number;
  pipelineValueUsd: number;
  closeProbability: number;
  projectedCloseDate: string | null;
  meetingsNeededPerWeek: number;
  currentVelocity: number;
  onTrack: boolean;
  stageConversionRates: Record<string, number>;
  avgDaysPerStage: Record<string, number>;
  createdAt: string;
}

export const forecastApi = {
  current: () => fetchClient<ForecastSnapshot>('/api/forecast/current'),
  recalculate: () => fetchClient<ForecastSnapshot>('/api/forecast/recalculate'),
};

// ─── Sentiment Monitoring ────────────────────────────────────────────────────

export interface SentimentAlertResponse {
  id: string;
  alertType: string;
  summary: string;
  recommendedAction: string | null;
  dismissedAt: string | null;
  createdAt: string;
  contact: { id: string; name: string | null; company: string | null; email: string };
  snapshot: {
    degradingSignals: string[];
    avgReplyLatencyHours: number | null;
    avgReplyLengthWords: number | null;
  };
}

export const sentimentApi = {
  alerts: () => fetchClient<SentimentAlertResponse[]>('/api/sentiment/alerts'),
  dismiss: (id: string) => fetchClient<{ success: boolean }>(`/api/sentiment/alerts/${id}/dismiss`, { method: 'PATCH' }),
  run: () => fetchClient<{ success: boolean }>('/api/sentiment/run', { method: 'POST' }),
};

// ─── Pre-Meeting Briefs ──────────────────────────────────────────────────────

export interface MeetingBriefResponse {
  id: string;
  meetingAt: string;
  briefMarkdown: string | null;
  viewedAt: string | null;
  generatedAt: string;
  contact: { id: string; name: string | null; company: string | null; email: string };
}

export const meetingsApi = {
  briefs: () => fetchClient<MeetingBriefResponse[]>('/api/meetings/briefs'),
  markViewed: (id: string) => fetchClient<{ success: boolean }>(`/api/meetings/briefs/${id}/viewed`, { method: 'PATCH' }),
  sync: () => fetchClient<{ success: boolean }>('/api/meetings/sync', { method: 'POST' }),
};

// ─── Raise Diagnostics ──────────────────────────────────────────────────────

export interface DiagnosticsReportResponse {
  id: string;
  reportDate: string;
  dropoutByStage: Record<string, { entered: number; droppedOut: number; rate: number }>;
  topDropoutTopics: { topic: string; dropoutRate: number; note?: string }[];
  highPerformingPhrases: string[];
  lowPerformingPhrases: string[];
  velocityTrend: string;
  narrativeSummary: string | null;
  createdAt: string;
}

export const diagnosticsApi = {
  latest: () => fetchClient<DiagnosticsReportResponse | null>('/api/diagnostics/latest'),
  generate: () => fetchClient<DiagnosticsReportResponse>('/api/diagnostics/generate', { method: 'POST' }),
};

// ─── Shared Workspace ───────────────────────────────────────────────────────

export interface OrgMemberResponse {
  id: string;
  orgId: string;
  userId: string;
  role: string;
  joinedAt: string;
}

export interface ActivityFeedItem {
  id: string;
  activityType: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export const workspaceApi = {
  org: () => fetchClient<any>('/api/workspace/org'),
  invite: (email: string, role?: string) => fetchClient<any>('/api/workspace/invite', {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  }),
  members: () => fetchClient<OrgMemberResponse[]>('/api/workspace/members'),
  updateRole: (memberId: string, role: string) => fetchClient<any>(`/api/workspace/members/${memberId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  }),
  removeMember: (memberId: string) => fetchClient<any>(`/api/workspace/members/${memberId}/remove`, { method: 'POST' }),
  notes: (contactId: string) => fetchClient<any[]>(`/api/workspace/contacts/${contactId}/notes`),
  addNote: (contactId: string, body: string) => fetchClient<any>(`/api/workspace/contacts/${contactId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  }),
  activity: () => fetchClient<ActivityFeedItem[]>('/api/workspace/activity'),
};

// ─── Pitch Deck Hosting ─────────────────────────────────────────────────────

export interface PitchDeckResponse {
  id: string;
  filename: string;
  storageUrl: string;
  pageCount: number;
  isActive: boolean;
  createdAt: string;
  shares: {
    id: string;
    shareToken: string;
    expiresAt: string | null;
    views: { startedAt: string; completedAt: string | null; pagesViewed: number[] }[];
  }[];
}

export interface DeckAnalytics {
  deckId: string;
  totalOpens: number;
  completedViews: number;
  avgViewTimeSeconds: number;
  pageEngagement: Record<number, number>;
  shareCount: number;
}

export const decksApi = {
  list: () => fetchClient<PitchDeckResponse[]>('/api/decks'),
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetchClient<PitchDeckResponse>('/api/decks/upload', {
      method: 'POST',
      body: formData,
    });
  },
  createShare: (deckId: string, contactId?: string, expiresInDays?: number) =>
    fetchClient<{ share: any; viewUrl: string }>(`/api/decks/${deckId}/share`, {
      method: 'POST',
      body: JSON.stringify({ contactId, expiresInDays }),
    }),
  analytics: (deckId: string) => fetchClient<DeckAnalytics>(`/api/decks/${deckId}/analytics`),
};

// ─── Backward compat ─────────────────────────────────────────────────────────

export const api = {
  getContacts: (params?: Record<string, string | undefined>) => {
    const clean: Record<string, string> = {};
    if (params) { for (const [k, v] of Object.entries(params)) { if (v !== undefined) clean[k] = v; } }
    return contactsApi.list(clean);
  },
  getContact: (id: string) => contactsApi.get(id),
  updateContact: (id: string, data: Record<string, string>) => contactsApi.update(id, data),
};

// ─── Feature Intelligence ────────────────────────────────────────────────────

export interface FounderProfile {
  id: string;
  userId: string;
  appName: string;
  appDescription: string;
  targetMarket: string;
  currentMRR: number;
  stage: string;
  fundingGoal: number;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureAnalysisResult {
  id: string;
  featureName: string;
  featureDescription: string;
  featureCategory: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  errorMessage?: string | null;
  verdict: string | null;
  verdictReasoning: string | null;
  revenueImpactLow: number;
  revenueImpactHigh: number;
  investorAlignmentScore: number;
  alignedInvestors: { name: string; firm: string; reason: string }[];
  marketPrecedents: { product: string; outcome: string; relevance: string }[];
  recommendations: { priority: number; action: string; rationale: string }[];
  estimatedBuildDays?: number | null;
  createdAt: string;
}

export interface PipelineEvent {
  type: 'connected' | 'stage_start' | 'stage_done' | 'stage_timeout' | 'stage_error' | 'complete' | 'failed';
  stage?: number;
  label?: string;
  elapsed?: number;
  detail?: string;
  result?: FeatureAnalysisResult;
}

export interface FounderProfileInput {
  appName: string;
  appDescription: string;
  targetMarket: string;
  currentMRR: number;
  stage: string;
  fundingGoal: number;
}

export const featureIntelligenceApi = {
  getProfile: () => fetchClient<FounderProfile | null>('/api/feature-analysis/profile'),
  upsertProfile: (data: FounderProfileInput) =>
    fetchClient<FounderProfile>('/api/feature-analysis/profile', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Submit for analysis — returns immediately with { analysisId } */
  analyze: (data: { featureName: string; featureDescription: string; featureCategory: string; estimatedBuildDays?: number }) =>
    fetchClient<{ analysisId: string; status: string }>('/api/feature-analysis', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Open an SSE stream to watch pipeline progress.
   * Returns an EventSource and calls onEvent for each PipelineEvent.
   */
  streamAnalysis: (
    analysisId: string,
    onEvent: (event: PipelineEvent) => void,
    onError?: (err: Event) => void,
  ): EventSource => {
    const url = `${API_BASE_URL}/api/feature-analysis/${analysisId}/stream`;
    const es = new EventSource(url, { withCredentials: true });

    es.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data) as PipelineEvent;
        onEvent(parsed);

        // Auto-close on terminal events
        if (parsed.type === 'complete' || parsed.type === 'failed') {
          es.close();
        }
      } catch {
        // Ignore malformed SSE data
      }
    };

    es.onerror = (err) => {
      onError?.(err);
      es.close();
    };

    return es;
  },

  list: () => fetchClient<FeatureAnalysisResult[]>('/api/feature-analysis'),
  getOne: (id: string) => fetchClient<FeatureAnalysisResult>(`/api/feature-analysis/${id}`),
};

// ─── Onboarding ─────────────────────────────────────────────────────────────

export interface OnboardingStep {
  step: number;
  title: string;
  description: string;
  component: string;
  isRequired: boolean;
  estimatedTime: number;
}

export interface OnboardingProgress {
  id: string;
  userId: string;
  currentStep: number;
  isCompleted: boolean;
  completedSteps: number[];
  stepsSkipped: number[];
  companyProfileCompleted: boolean;
  investorMatchingViewed: boolean;
  contactsImported: boolean;
  firstActionTaken: boolean;
  startedAt: string;
  completedAt: string | null;
  timeToComplete: number | null;
  steps: OnboardingStep[];
  totalSteps: number;
}

export const onboardingApi = {
  getProgress: () => fetchClient<OnboardingProgress>('/onboarding'),
  getStep: (stepNumber: number) => fetchClient<OnboardingStep>(`/onboarding/steps/${stepNumber}`),
  completeStep: (stepNumber: number, stepData?: Record<string, any>) =>
    fetchClient<OnboardingProgress>(`/onboarding/steps/${stepNumber}/complete`, {
      method: 'POST',
      body: JSON.stringify({ stepData }),
    }),
  skipStep: (stepNumber: number) =>
    fetchClient<OnboardingProgress>(`/onboarding/steps/${stepNumber}/skip`, {
      method: 'POST',
    }),
  updateCompanyProfile: (profileData: any) =>
    fetchClient<any>('/onboarding/company-profile', {
      method: 'POST',
      body: JSON.stringify(profileData),
    }),
  markComplete: () =>
    fetchClient<OnboardingProgress>('/onboarding/complete', {
      method: 'POST',
    }),
  reset: () =>
    fetchClient<OnboardingProgress>('/onboarding/reset', {
      method: 'POST',
    }),
};

// ─── Billing ────────────────────────────────────────────────────────────────

export interface Plan {
  id: string;
  name: string;
  displayName: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  creditsPerMonth: number;
  isActive: boolean;
  sortOrder: number;
  features: {
    feature: {
      id: string;
      name: string;
      description: string;
      category: string;
      creditsRequired: number;
    };
  }[];
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: string;
  billingCycle: 'monthly' | 'yearly';
  currentPeriodEnd: string;
  plan: Plan;
}

export interface CreditBalance {
  userId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  lastResetAt: string | null;
  updatedAt: string;
}

export const billingApi = {
  getPlans: () => fetchClient<{ plans: Plan[] }>('/billing/plans'),
  getCurrentSubscription: () => fetchClient<Subscription>('/billing/subscription'),
  createSubscription: (planId: string, billingCycle: 'monthly' | 'yearly') =>
    fetchClient<Subscription>('/billing/subscribe', {
      method: 'POST',
      body: JSON.stringify({ planId, billingCycle }),
    }),
  getCreditBalance: () => fetchClient<CreditBalance>('/billing/credits'),
  purchaseCredits: (amount: number, paymentMethodId: string) =>
    fetchClient<{ success: boolean; message: string }>('/billing/credits/purchase', {
      method: 'POST',
      body: JSON.stringify({ amount, paymentMethodId }),
    }),
  getUsage: () => fetchClient<{ featureUsage: any[] }>('/billing/usage'),
};



