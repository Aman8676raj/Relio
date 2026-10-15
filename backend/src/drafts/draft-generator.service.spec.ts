import { Test, TestingModule } from '@nestjs/testing';
import { DraftGeneratorService } from './draft-generator.service';
import { PrismaService } from '../prisma';
import { ConfigService } from '@nestjs/config';

// Mock crypto.randomUUID
jest.mock('crypto', () => {
  return {
    ...jest.requireActual('crypto'),
    randomUUID: jest.fn().mockReturnValue('d-1'),
  };
});

describe('DraftGeneratorService', () => {
  let service: DraftGeneratorService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const prismaMock = {
      draft: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      user: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
      contact: { findFirstOrThrow: jest.fn(), findUniqueOrThrow: jest.fn() },
      emailThread: { findFirst: jest.fn(), findMany: jest.fn() },
    };

    const configMock = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'ANTHROPIC_API_KEY') return 'test-api-key';
        return null;
      }),
      getOrThrow: jest.fn().mockImplementation((key: string) => {
        if (key === 'ANTHROPIC_API_KEY') return 'test-api-key';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DraftGeneratorService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<DraftGeneratorService>(DraftGeneratorService);
    prismaService = module.get<PrismaService>(PrismaService);
    
    // Mock the internal anthropic client
    (service as any).client = {
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Test Body' }],
        }),
      },
    };
  });

  describe('generateDraftSync', () => {
    it('should generate a draft using Claude and return text', async () => {
      (prismaService.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({ id: 'u-1', name: 'User' });
      (prismaService.contact.findFirstOrThrow as jest.Mock).mockResolvedValue({ id: 'c-1', name: 'Contact' });
      (prismaService.emailThread.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.generateDraftSync('c-1', 'u-1');

      expect((service as any).client.messages.create).toHaveBeenCalled();
      expect(result).toBe('Test Body');
    });
  });
});
