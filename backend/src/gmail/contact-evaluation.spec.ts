import { evaluateContact } from './contact-evaluation';

describe('evaluateContact', () => {
  const baseParams = {
    email: 'investor@firm.com',
    userEmail: 'founder@demo.com',
    headers: [] as { name: string; value: string }[],
    threadParticipantCount: 2,
    userHasSent: true,
    contactHasReplied: true,
  };

  it('excludes transactional domains', () => {
    expect(
      evaluateContact({
        ...baseParams,
        email: 'updates@facebookmail.com',
      }),
    ).toEqual({
      include: false,
      status: 'excluded',
      reason: 'transactional_domain',
    });
  });

  it('excludes list emails when List-Unsubscribe is present', () => {
    expect(
      evaluateContact({
        ...baseParams,
        headers: [{ name: 'List-Unsubscribe', value: '<mailto:unsubscribe>' }],
      }),
    ).toEqual({
      include: false,
      status: 'excluded',
      reason: 'list_email',
    });
  });

  it('excludes mass email threads', () => {
    expect(
      evaluateContact({
        ...baseParams,
        threadParticipantCount: 25,
      }),
    ).toEqual({
      include: false,
      status: 'excluded',
      reason: 'mass_email',
    });
  });

  it('marks one-way exchanges as pending review', () => {
    expect(
      evaluateContact({
        ...baseParams,
        contactHasReplied: false,
      }),
    ).toEqual({
      include: null,
      status: 'pending_review',
      reason: 'unidirectional',
    });
  });

  it('marks bidirectional exchanges as active', () => {
    expect(evaluateContact(baseParams)).toEqual({
      include: true,
      status: 'active',
      reason: '',
    });
  });

  it('excludes self email', () => {
    expect(
      evaluateContact({
        ...baseParams,
        email: 'founder@demo.com',
      }),
    ).toEqual({
      include: false,
      status: 'excluded',
      reason: 'self',
    });
  });
});
