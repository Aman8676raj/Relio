import { Test, TestingModule } from '@nestjs/testing';
import { ContactBriefingService } from './contact-briefing.service';
import { PrismaService } from '../prisma';
import { ConfigService } from '@nestjs/config';

describe('ContactBriefingService', () => {
  let service: ContactBriefingService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const prismaMock = {
      contactBriefing: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      emailThread: {
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      contact: {
        findFirstOrThrow: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const configMock = {
      get: jest.fn().mockReturnValue('dummy-key'),
      getOrThrow: jest.fn().mockReturnValue('dummy-key'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactBriefingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<ContactBriefingService>(ContactBriefingService);
    prismaService = module.get<PrismaService>(PrismaService);
    
    // Mock the SDK directly via overriding private member
    (service as any).client = {
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [
            { type: 'text', text: '{"summary": "Met context", "openQuestions": [], "actionItems": [], "commitments": []}' }
          ]
        })
      }
    };
  });

  describe('getBriefing', () => {
    it('should generate via claude and upsert the database', async () => {
      (prismaService.contact.findFirstOrThrow as jest.Mock).mockResolvedValue({ id: 'c-1', name: 'Investor', warmthTier: 'warm' });
      (prismaService.emailThread.findMany as jest.Mock).mockResolvedValue([
        { id: '1', fullContent: 'Recent discussions', messageCount: 1 }
      ]);
      (prismaService.contactBriefing.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.contactBriefing.upsert as jest.Mock).mockResolvedValue({
        id: 'brief-1',
        summary: 'Met context',
        keyFacts: [],
        openQuestions: [],
        commitments: [],
        sentiment: 'positive',
        lastMeetingMentioned: null,
        updatedAt: new Date(),
      });

      const result = await service.getBriefing('c-1', 'u-1');
      
      expect(result).toBeDefined();
      expect(prismaService.contactBriefing.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { contactId: 'c-1' }
      }));
    });
  });
});
