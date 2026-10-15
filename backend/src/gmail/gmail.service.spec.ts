import { Test, TestingModule } from '@nestjs/testing';
import { GmailService } from './gmail.service';
import { PrismaService } from '../prisma';
import { GoogleOAuthService } from '../auth/google-oauth.service';
import { WarmthService } from '../warmth/warmth.service';
import { PipelineService } from '../pipeline/pipeline.service';

describe('GmailService', () => {
  let service: GmailService;
  let prismaService: PrismaService;
  let googleOAuthService: GoogleOAuthService;

  beforeEach(async () => {
    const prismaMock = {
      user: { findUnique: jest.fn(), update: jest.fn(), findUniqueOrThrow: jest.fn() },
      emailMessage: { upsert: jest.fn(), findMany: jest.fn() },
      emailMessageParticipant: { deleteMany: jest.fn(), createMany: jest.fn() },
      contact: { upsert: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
      emailThread: { upsert: jest.fn(), deleteMany: jest.fn() },
    };

    const googleMock = {
      getGmailClient: jest.fn().mockResolvedValue({
        users: {
          messages: {
            send: jest.fn().mockResolvedValue({ data: { id: 'mid-1', threadId: 'tid-1' } }),
            get: jest.fn(),
          },
          threads: {
            get: jest.fn(),
          },
          profile: {
            get: jest.fn().mockResolvedValue({ data: { historyId: 'abc' } }),
          }
        }
      })
    };

    const warmthMock = { computeWarmthScores: jest.fn() };
    const pipelineMock = { detectSignalsAndProgress: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GmailService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: GoogleOAuthService, useValue: googleMock },
        { provide: WarmthService, useValue: warmthMock },
        { provide: PipelineService, useValue: pipelineMock },
      ],
    }).compile();

    service = module.get<GmailService>(GmailService);
    prismaService = module.get<PrismaService>(PrismaService);
    googleOAuthService = module.get<GoogleOAuthService>(GoogleOAuthService);
  });

  describe('sendEmail', () => {
    it('should construct standard email payload and dispatch', async () => {
      (prismaService.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        email: 'founder@demo.com',
        name: 'Founder',
      });

      const result = await service.sendEmail('u-1', 'investor@vc.com', 'Subject', 'Body text');
      
      expect(result.messageId).toBe('mid-1');
      expect(result.threadId).toBe('tid-1');
      expect(googleOAuthService.getGmailClient).toHaveBeenCalledWith('u-1');
    });
  });

  describe('checkForReplies', () => {
    it('should return false if thread has no new inbound activities', async () => {
      (prismaService.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        email: 'founder@demo.com',
      });
      // Mock get thread internal messages
      const mockGmailClient = await googleOAuthService.getGmailClient('u-1');
      (mockGmailClient.users.messages.get as jest.Mock).mockResolvedValue({
        data: { threadId: 'tid-1' }
      });
      (mockGmailClient.users.threads.get as jest.Mock).mockResolvedValue({
        data: {
          messages: [
            { id: 'mid-old', internalDate: '100', payload: { headers: [{ name: 'From', value: 'founder@demo.com' }] } },
          ]
        }
      });

      const result = await service.checkForReplies('u-1', 'mid-old', new Date(150));
      expect(result.hasReply).toBe(false);
    });
  });
});
