import { Test, TestingModule } from '@nestjs/testing';
import { PipelineService } from './pipeline.service';
import { PrismaService } from '../prisma';

describe('PipelineService', () => {
  let service: PipelineService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    // Basic mock of PrismaService methods used in PipelineService
    const prismaMock = {
      user: { update: jest.fn() },
      contact: { 
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn() 
      },
      pipelineEvent: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      draft: { updateMany: jest.fn() },
      $transaction: jest.fn((callback) => callback(prismaMock)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelineService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<PipelineService>(PipelineService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('moveStage', () => {
    it('should transition stage and generate an event', async () => {
      const mockContact = {
        id: 'c-1',
        userId: 'u-1',
        pipelineStage: 'none',
      };
      
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(mockContact);
      (prismaService.contact.update as jest.Mock).mockResolvedValue({
        ...mockContact,
        pipelineStage: 'intro',
      });
      (prismaService.pipelineEvent.create as jest.Mock).mockResolvedValue({
        id: 'event-1',
      });

      const result = await service.moveStage('u-1', 'c-1', 'intro', 'manual', 'Manual test');
      
      expect(prismaService.contact.findFirst).toHaveBeenCalledWith({
        where: { id: 'c-1', userId: 'u-1' },
      });
      expect(prismaService.contact.update).toHaveBeenCalledWith({
        where: { id: 'c-1' },
        data: expect.objectContaining({ pipelineStage: 'intro' }),
      });
      expect(prismaService.pipelineEvent.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          contactId: 'c-1',
          userId: 'u-1',
          fromStage: 'none',
          toStage: 'intro',
          trigger: 'manual',
        }),
      }));
      expect(result?.pipelineStage).toBe('intro');
    });

    it('should not transition if stage is the same', async () => {
        const mockContact = {
            id: 'c-1',
            userId: 'u-1',
            pipelineStage: 'intro',
        };
        (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(mockContact);
        
        await service.moveStage('u-1', 'c-1', 'intro');
        expect(prismaService.pipelineEvent.create).not.toHaveBeenCalled();
    });
  });

  describe('getVelocity', () => {
    it('should calculate stats for the pipeline', async () => {
      (prismaService.contact.findMany as jest.Mock).mockResolvedValue([
        { id: '1', pipelineStage: 'intro', lastContactedAt: new Date(), firstContactedAt: new Date(Date.now() - 86400000) },
        { id: '2', pipelineStage: 'meeting', lastContactedAt: new Date(), firstContactedAt: new Date(Date.now() - 86400000 * 2) },
      ]);
      (prismaService.pipelineEvent.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getVelocity('u-1');

      expect(result.stages.find(s => s.stage === 'intro')?.contacts).toBe(1);
      expect(result.stages.find(s => s.stage === 'meeting')?.contacts).toBe(1);
    });
  });
});
