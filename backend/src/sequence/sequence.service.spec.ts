import { Test, TestingModule } from '@nestjs/testing';
import { SequenceService } from './sequence.service';
import { SequenceGeneratorService } from './sequence-generator.service';
import { PrismaService } from '../prisma';

describe('SequenceService', () => {
  let service: SequenceService;
  let prismaService: PrismaService;
  let generatorService: SequenceGeneratorService;

  beforeEach(async () => {
    const prismaMock = {
      sequence: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      sequenceEnrollment: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      sequenceEmail: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      contact: {
        findFirst: jest.fn(),
      },
    };

    const generatorMock = {
      generateEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SequenceService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SequenceGeneratorService, useValue: generatorMock },
      ],
    }).compile();

    service = module.get<SequenceService>(SequenceService);
    prismaService = module.get<PrismaService>(PrismaService);
    generatorService = module.get<SequenceGeneratorService>(SequenceGeneratorService);
  });

  describe('createSequence', () => {
    it('should create a sequence with default steps if not provided', async () => {
      (prismaService.sequence.create as jest.Mock).mockResolvedValue({ id: 'seq-1' });

      await service.createSequence('u-1', { name: 'Q3 Outreach' });

      expect(prismaService.sequence.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u-1',
          name: 'Q3 Outreach',
          steps: expect.any(Array),
        })
      }));
    });
  });

  describe('updateSequenceStatus', () => {
    it('should activate approved emails when changing to active', async () => {
        const mockSequence = { id: 'seq-1', status: 'draft', steps: [{ step: 1, dayOffset: 0 }] };
        (prismaService.sequence.findFirst as jest.Mock).mockResolvedValue(mockSequence);
        (prismaService.sequenceEnrollment.findMany as jest.Mock).mockResolvedValue([
            { id: 'enr-1', status: 'approved', currentStep: 1 },
        ]);

        await service.updateSequenceStatus('u-1', 'seq-1', 'active');

        expect(prismaService.sequenceEnrollment.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'enr-1' },
            data: expect.objectContaining({ status: 'active' })
        }));
        expect(prismaService.sequence.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'seq-1' },
            data: { status: 'active' }
        }));
    });
  });

  describe('batchApprove', () => {
    it('should approve all draft emails and enrollments', async () => {
        (prismaService.sequenceEnrollment.findMany as jest.Mock).mockResolvedValue([
            { id: 'enr-1', emails: [{ id: 'email-1' }] },
        ]);
        
        await service.batchApprove('u-1', 'seq-1');

        expect(prismaService.sequenceEmail.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'email-1' },
            data: expect.objectContaining({ status: 'approved' })
        }));
        expect(prismaService.sequenceEnrollment.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'enr-1' },
            data: { status: 'approved' }
        }));
    });
  });
});
