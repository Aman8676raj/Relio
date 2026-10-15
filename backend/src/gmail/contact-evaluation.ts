export type ContactInclusionStatus = 'active' | 'pending_review' | 'excluded';

export type ContactExclusionReason =
  | 'transactional_domain'
  | 'transactional_prefix'
  | 'list_email'
  | 'mass_email'
  | 'unidirectional'
  | 'self';

export interface ContactEvaluationHeader {
  name: string;
  value: string;
}

export interface ContactEvaluationResult {
  include: boolean | null;
  status: ContactInclusionStatus;
  reason: string;
}

export const TRANSACTIONAL_DOMAINS = new Set([
  'facebookmail.com',
  'linkedin.com',
  'notifications.google.com',
  'mail.notion.so',
  'github.com',
  'atlassian.com',
  'mailchimp.com',
  'sendgrid.net',
  'amazonses.com',
  'bounce.linkedin.com',
  'twitter.com',
  'indeedemail.com',
  'em.notion.so',
  'reply.github.com',
  'mg.notion.so',
  'bounce.notion.so',
  'e.notion.so',
]);

const TRANSACTIONAL_PREFIX_PATTERN =
  /^(?:noreply|no-reply|donotreply|do-not-reply|bounce|mailer-daemon|notification|notifications|newsletter|support|hello|info|admin|postmaster|unsubscribe|automated|digest|updates|alerts|team|news|billing|invoices|careers|jobs|hire|recruit)(?:$|[+._-]|\d)/i;

const TRANSACTIONAL_X_MAILER_PATTERN = /(mailchimp|sendgrid|klaviyo|hubspot)/i;

function getDomain(email: string): string {
  const [, domain = ''] = email.toLowerCase().split('@');
  return domain;
}

function isTransactionalDomain(email: string): boolean {
  const domain = getDomain(email);
  if (!domain) return false;

  for (const blockedDomain of TRANSACTIONAL_DOMAINS) {
    if (domain === blockedDomain || domain.endsWith(`.${blockedDomain}`)) {
      return true;
    }
  }

  return false;
}

function isTransactionalPrefix(email: string): boolean {
  const [localPart = ''] = email.toLowerCase().split('@');
  return TRANSACTIONAL_PREFIX_PATTERN.test(localPart);
}

export function isTransactionalByHeaders(
  headers: ContactEvaluationHeader[],
): boolean {
  for (const header of headers) {
    const name = header.name.toLowerCase();
    const value = header.value.toLowerCase();

    if (name === 'list-unsubscribe' || name === 'list-id') {
      return true;
    }

    if (name === 'x-mailer' && TRANSACTIONAL_X_MAILER_PATTERN.test(value)) {
      return true;
    }
  }

  return false;
}

export function evaluateContact(params: {
  email: string;
  userEmail: string;
  headers: ContactEvaluationHeader[];
  threadParticipantCount: number;
  userHasSent: boolean;
  contactHasReplied: boolean;
}): ContactEvaluationResult {
  const email = params.email.trim().toLowerCase();
  const userEmail = params.userEmail.trim().toLowerCase();

  if (!email || email === userEmail) {
    return {
      include: false,
      status: 'excluded',
      reason: 'self',
    };
  }

  if (isTransactionalDomain(email)) {
    return {
      include: false,
      status: 'excluded',
      reason: 'transactional_domain',
    };
  }

  if (isTransactionalPrefix(email)) {
    return {
      include: false,
      status: 'excluded',
      reason: 'transactional_prefix',
    };
  }

  if (isTransactionalByHeaders(params.headers)) {
    return {
      include: false,
      status: 'excluded',
      reason: 'list_email',
    };
  }

  if (params.threadParticipantCount > 20) {
    return {
      include: false,
      status: 'excluded',
      reason: 'mass_email',
    };
  }

  if (!params.userHasSent || !params.contactHasReplied) {
    return {
      include: null,
      status: 'pending_review',
      reason: 'unidirectional',
    };
  }

  return {
    include: true,
    status: 'active',
    reason: '',
  };
}
