import { Module } from '@nestjs/common';
import { FeatureAnalysisController } from './feature-analysis.controller';
import { FeatureAnalysisService } from './feature-analysis.service';
import { ContextAssemblyService } from './context-assembly.service';
import { MarketIntelligenceService } from './market-intelligence.service';
import { SynthesisService } from './synthesis.service';
import { InvestorAlignmentService } from './investor-alignment.service';
import { PrismaModule } from '../prisma';

@Module({
  imports: [PrismaModule],
  controllers: [FeatureAnalysisController],
  providers: [
    FeatureAnalysisService,
    ContextAssemblyService,
    MarketIntelligenceService,
    SynthesisService,
    InvestorAlignmentService,
  ],
  exports: [FeatureAnalysisService],
})
export class FeatureAnalysisModule {}
