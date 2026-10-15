import { Module } from '@nestjs/common';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { ScoringEngineService } from './scoring-engine.service';

@Module({
  controllers: [DiscoveryController],
  providers: [DiscoveryService, ScoringEngineService],
  exports: [DiscoveryService, ScoringEngineService],
})
export class DiscoveryModule {}
